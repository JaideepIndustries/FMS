const StatusUpdate = () => {
  console.log('StatusUpdate component initializing');
  
  // State declarations
  const [orderbook, setOrderbook] = React.useState([]);
  const [warpingProduction, setWarpingProduction] = React.useState([]);
  const [sizingProduction, setSizingProduction] = React.useState([]);
  const [beamOnLoom, setBeamOnLoom] = React.useState([]);
  const [greyProduction, setGreyProduction] = React.useState([]);
  const [unit259Production, setUnit259Production] = React.useState([]);
  
  const [searchOrderNo, setSearchOrderNo] = React.useState('');
  const [searchDesignNo, setSearchDesignNo] = React.useState('');
  const [searchPartyName, setSearchPartyName] = React.useState('');
  
  const [filteredData, setFilteredData] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Data fetching effect
  React.useEffect(() => {
    console.log('Starting data fetch...');
    
    const fetchEndpoint = async (url, name) => {
      console.log(`Fetching ${name} from ${url}...`);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`${name} data received:`, data);
        return data;
      } catch (error) {
        console.error(`Error fetching ${name}:`, error);
        throw error;
      }
    };

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const endpoints = {
          orderbook: '/api/orderbook',
          warping: '/api/warping-production',
          sizing: '/api/sizing-production',
          beam: '/api/beam-on-loom',
          grey: '/api/grey-production',
          unit259: '/api/unit259-production'
        };

        // First fetch orderbook
        const orderbookData = await fetchEndpoint(endpoints.orderbook, 'orderbook');
        setOrderbook(orderbookData);
        setFilteredData(orderbookData);

        // Fetch remaining data in parallel
        const [warpingData, sizingData, beamData, greyData, unit259Data] = await Promise.all([
          fetchEndpoint(endpoints.warping, 'warping'),
          fetchEndpoint(endpoints.sizing, 'sizing'),
          fetchEndpoint(endpoints.beam, 'beam'),
          fetchEndpoint(endpoints.grey, 'grey'),
          fetchEndpoint(endpoints.unit259, 'unit259')
        ]);

        setWarpingProduction(warpingData);
        setSizingProduction(sizingData);
        setBeamOnLoom(beamData);
        setGreyProduction(greyData);
        setUnit259Production(unit259Data);

        console.log('All data fetched successfully');
      } catch (error) {
        console.error('Error in data fetching:', error);
        setError(error.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get unique values for autocomplete
  const uniqueOrderNos = React.useMemo(() => 
    Array.from(new Set(orderbook.map(item => item['Order No.']))),
    [orderbook]
  );
  
  const uniqueDesignNos = React.useMemo(() => 
    Array.from(new Set(orderbook.map(item => item['Design No.']))),
    [orderbook]
  );
  
  const uniquePartyNames = React.useMemo(() => 
    Array.from(new Set(orderbook.map(item => item['Party Name']))),
    [orderbook]
  );

  // Format timestamp helper function
  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === '-') return '-';
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  // Simple and direct status calculation
  const calculateStatus = (record) => {
    if (!record || !record['Design No.']) {
      return { status: 'Unknown', meters: 0 };
    }

    const designNo = record['Design No.'];
    
    // Ensure all data arrays exist
    if (!Array.isArray(warpingProduction) || !Array.isArray(sizingProduction) || 
        !Array.isArray(beamOnLoom) || !Array.isArray(greyProduction) || 
        !Array.isArray(unit259Production)) {
      return { status: 'Loading...', meters: 0 };
    }
    
    // First check if the design exists in warping production
    const beamsForDesign = warpingProduction.filter(wp => 
      String(wp.design_no) === String(designNo)
    );

    if (beamsForDesign.length === 0) {
      return { 
        status: 'Order Received', 
        meters: 0,
        timestamp: '-' 
      };
    }

    // For each beam, check its status
    for (const beam of beamsForDesign) {
      const beamNo = beam.beam_no;

      // Get all status updates for this beam
      const beamStatuses = beamOnLoom.filter(bol => 
        String(bol.beam_no) === String(beamNo)
      );
      
      // Find the latest status by timestamp
      const loomStatus = beamStatuses.reduce((latest, current) => {
        if (!latest) return current;
        return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
      }, null);
      
      if (loomStatus) {
        // Return the actual status and timestamp from beam on loom
        return { 
          status: loomStatus.status || 'Status Not Available',
          meters: 0,
          timestamp: loomStatus.timestamp
        };
      }
      
      // Check if beam is in sizing
      const inSizing = sizingProduction.find(sp => 
        String(sp.beam_no) === String(beamNo)
      );
      
      if (inSizing) {
        return { 
          status: 'Sizing Done', 
          meters: 0,
          timestamp: inSizing.timestamp || '-'
        };
      }
    }

    // If none of the above conditions are met, return Warping Done with timestamp
    const latestWarping = beamsForDesign.reduce((latest, current) => {
      if (!latest) return current;
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    }, null);

    return { 
      status: 'Warping Done', 
      meters: 0,
      timestamp: latestWarping?.timestamp || '-'
    };
  };

  // Filter effect
  React.useEffect(() => {
    let filtered = orderbook;

    if (searchOrderNo) {
      filtered = filtered.filter(item => 
        String(item['Order No.']).toLowerCase().includes(searchOrderNo.toLowerCase())
      );
    }

    if (searchDesignNo) {
      filtered = filtered.filter(item =>
        String(item['Design No.']).toLowerCase().includes(searchDesignNo.toLowerCase())
      );
    }

    if (searchPartyName) {
      filtered = filtered.filter(item =>
        String(item['Party Name']).toLowerCase().includes(searchPartyName.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [searchOrderNo, searchDesignNo, searchPartyName, orderbook]);

  // Render search inputs
  const renderSearchInput = (placeholder, value, setValue, listId, options) => {
    return React.createElement('div', { className: 'relative' },
      React.createElement('input', {
        type: 'text',
        list: listId,
        className: 'w-full p-2 border rounded-md pl-8',
        placeholder,
        value,
        onChange: (e) => setValue(e.target.value)
      }),
      React.createElement('span', { 
        className: 'absolute left-2 top-2.5 h-4 w-4 text-gray-400'
      }),
      React.createElement('datalist', { id: listId },
        options.map(opt => React.createElement('option', { key: opt, value: opt }))
      )
    );
  };

  // Render status cell
  const renderStatusCell = (status) => {
    const displayStatus = status.status || 'Unknown';
    const displayMeters = status.meters > 0 ? ` (${status.meters} meters)` : '';
    
    return React.createElement('span', {
      className: 'px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800'
    }, `${displayStatus}${displayMeters}`);
  };

  // Render table
  const renderTable = () => {
    return React.createElement('div', { className: 'overflow-x-auto' },
      React.createElement('table', { className: 'min-w-full bg-white border rounded-lg' },
        React.createElement('thead', { className: 'bg-gray-50' },
          React.createElement('tr', null,
            ['Order No.', 'Design No.', 'Party Name', 'Quantity (Meters)', 'Status Update', 'Last Updated'].map(header =>
              React.createElement('th', { 
                key: header,
                className: 'px-6 py-3 text-left text-sm font-medium text-gray-500' 
              }, header)
            )
          )
        ),
        React.createElement('tbody', { className: 'divide-y divide-gray-200' },
          filteredData.map((record, index) => {
            const status = calculateStatus(record);
            return React.createElement('tr', { key: index, className: 'hover:bg-gray-50' },
              React.createElement('td', { className: 'px-6 py-4 text-sm text-gray-900' }, record['Order No.']),
              React.createElement('td', { className: 'px-6 py-4 text-sm text-gray-900' }, record['Design No.']),
              React.createElement('td', { className: 'px-6 py-4 text-sm text-gray-900' }, record['Party Name']),
              React.createElement('td', { className: 'px-6 py-4 text-sm text-gray-900' }, record['Quantity (Meters)']),
              React.createElement('td', { className: 'px-6 py-4 text-sm' },
                renderStatusCell(status)
              ),
              React.createElement('td', { className: 'px-6 py-4 text-sm text-gray-900' }, 
                formatTimestamp(status.timestamp)
              )
            );
          })
        )
      )
    );
  };

  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'text-center py-4' }, [
      React.createElement('p', { key: 'loading' }, 'Loading data...'),
      React.createElement('p', { 
        key: 'loading-details',
        className: 'text-sm text-gray-500' 
      }, 'Please wait while we fetch the latest production data')
    ]);
  }

  // Render error state
  if (error) {
    return React.createElement('div', { 
      className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4' 
    }, [
      React.createElement('p', { key: 'error-title', className: 'font-bold' }, 'Error loading data:'),
      React.createElement('p', { key: 'error-message' }, error)
    ]);
  }

  // Main render
  return React.createElement('div', { className: 'container mx-auto p-4' },
    React.createElement('div', { className: 'grid grid-cols-3 gap-4 mb-6' },
      renderSearchInput('Search Order No.', searchOrderNo, setSearchOrderNo, 'orderNos', uniqueOrderNos),
      renderSearchInput('Search Design No.', searchDesignNo, setSearchDesignNo, 'designNos', uniqueDesignNos),
      renderSearchInput('Search Party Name', searchPartyName, setSearchPartyName, 'partyNames', uniquePartyNames)
    ),
    renderTable()
  );
};

// Export for browser usage
window.StatusUpdate = StatusUpdate;