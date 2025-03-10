(function(window) {
  'use strict';
  
  const GreyProductionDashboard = () => {
    console.log('GreyProductionDashboard component initializing');
    
    // State declarations
    const [orderbook, setOrderbook] = React.useState([]);
    const [warpingProduction, setWarpingProduction] = React.useState([]);
    const [beamOnLoom, setBeamOnLoom] = React.useState([]);
    const [unit259Production, setUnit259Production] = React.useState([]);
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [visibleLooms, setVisibleLooms] = React.useState(10);

    // Helper Functions
    const getStatusColor = (status) => ({
      'Downtime': '#ff0000',
      'Production': '#00ff00',
      'Knotting': '#0000ff',
      'Drawing': '#0000ff',
      'QC': '#ffff00',
      'Beam End': '#ffa500'
    }[status] || '#808080');

    const getMetadata = React.useCallback((loomNo) => {
      const production = unit259Production.find(p => p.loom_no === loomNo);
      if (!production) return null;

      const orderData = orderbook.find(o => o['Design No.'] === production.design_no);
      const warpingData = warpingProduction.find(w => w.design_no === production.design_no);

      return {
        designNo: production.design_no,
        reed: production.reed || 'N/A',
        rpm: production.rpm || 'N/A',
        ppi: production.ppi || 'N/A',
        warpingMeters: warpingData ? warpingData.quantity : 0,
        balanceMeters: (warpingData ? warpingData.quantity : 0) - (production.production_meters || 0),
        partyName: orderData ? orderData['Party Name'] : 'N/A',
        weftShades: orderData ? orderData['Weft Shades'] : 'N/A',
        weftCount: orderData ? orderData['Weft Count'] : 'N/A'
      };
    }, [orderbook, unit259Production, warpingProduction]);

    const getTimelineData = React.useCallback((loomNo) => {
      const timeSlots = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        status: 'Downtime',
        color: '#ff0000'
      }));

      const beamData = beamOnLoom.filter(b => 
        b.loom_no === loomNo && b.date === selectedDate
      );

      beamData.forEach(beam => {
        const hour = parseInt(beam.time);
        if (timeSlots[hour]) {
          timeSlots[hour].status = `${beam.process} ${beam.process_update}`;
          timeSlots[hour].color = getStatusColor(beam.process);
        }
      });

      const productionData = unit259Production.filter(p => 
        p.loom_no === loomNo && p.date === selectedDate
      );

      productionData.forEach(prod => {
        if (prod.shift === 'Day') {
          for (let i = 8; i < 20; i++) {
            if (timeSlots[i].status === 'Downtime') {
              timeSlots[i].status = 'Production';
              timeSlots[i].color = '#00ff00';
            }
          }
        } else {
          for (let i = 20; i < 24; i++) {
            if (timeSlots[i].status === 'Downtime') {
              timeSlots[i].status = 'Production';
              timeSlots[i].color = '#00ff00';
            }
          }
          for (let i = 0; i < 8; i++) {
            if (timeSlots[i].status === 'Downtime') {
              timeSlots[i].status = 'Production';
              timeSlots[i].color = '#00ff00';
            }
          }
        }
      });

      return timeSlots;
    }, [beamOnLoom, unit259Production, selectedDate]);

    const getMetrics = React.useCallback((loomNo) => {
      const production = unit259Production.find(p => 
        p.loom_no === loomNo && p.date === selectedDate
      );

      if (!production) return null;

      return {
        efficiency: production.efficiency || 0,
        productionMeters: production.production_meters || 0,
        lossMeters: production.loss_meters || 0,
        warpBreakages: production.warp_breakages || 0,
        weftBreakages: production.weft_breakages || 0,
        weaver: production.weaver_name || 'N/A',
        reliever: production.reliever_name || 'N/A',
        foreman: production.foreman || 'N/A',
        qc: production.qc_checker || 'N/A',
        quality: production.quality || 'N/A',
        comments: production.comments || 'N/A'
      };
    }, [unit259Production, selectedDate]);

    // Data fetching effect
    React.useEffect(() => {
      const fetchData = async () => {
        try {
          setIsLoading(true);
          setError(null);

          const [orderbookData, warpingData, beamData, unit259Data] = await Promise.all([
            fetch('/api/orderbook').then(r => r.json()),
            fetch('/api/warping-production').then(r => r.json()),
            fetch('/api/beam-on-loom').then(r => r.json()),
            fetch('/api/unit259-production').then(r => r.json())
          ]);

          console.log('Fetched Data:', {
            orderbook: orderbookData,
            warping: warpingData,
            beam: beamData,
            unit259: unit259Data
          });

          setOrderbook(orderbookData);
          setWarpingProduction(warpingData);
          setBeamOnLoom(beamData);
          setUnit259Production(unit259Data);
        } catch (error) {
          console.error('Error in data fetching:', error);
          setError('Failed to load data');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }, []);

    const renderLoomRow = React.useCallback((loomNo) => {
      const metadata = getMetadata(loomNo);
      const timelineData = getTimelineData(loomNo);
      const metrics = getMetrics(loomNo);

      return React.createElement('div', {
        key: `loom-row-${loomNo}`,
        className: 'border rounded-lg p-4 mb-4 bg-white shadow'
      }, [
        // Metadata section
        React.createElement('div', {
          key: `metadata-section-${loomNo}`,
          className: 'grid grid-cols-5 gap-4 mb-4'
        }, [
          React.createElement('div', { 
            key: `loom-number-${loomNo}`,
            className: 'font-bold' 
          }, `Loom ${loomNo}`),
          metadata && Object.entries(metadata).map(([key, value]) => 
            React.createElement('div', { 
              key: `${key}-${loomNo}` 
            }, `${key}: ${value}`)
          )
        ]),

        // Timeline section
        React.createElement('div', {
          key: `timeline-${loomNo}`,
          className: 'h-8 mb-4 flex'
        }, timelineData.map((slot, index) => 
          React.createElement('div', {
            key: `slot-${loomNo}-${index}`,
            className: 'h-full',
            style: {
              width: `${100/24}%`,
              backgroundColor: slot.color,
              borderRight: '1px solid white'
            },
            title: `${slot.hour}:00 - ${slot.status}`
          })
        )),

        // Metrics section
        metrics && React.createElement('div', {
          key: `metrics-${loomNo}`,
          className: 'grid grid-cols-3 gap-4'
        }, [
          React.createElement('div', { 
            key: `efficiency-${loomNo}`, 
            className: 'col-span-3' 
          }, [
            React.createElement('div', { 
              key: 'label',
              className: 'font-bold mb-1' 
            }, 'Efficiency'),
            React.createElement('div', { 
              key: 'bar',
              className: 'h-4 bg-gray-200 rounded overflow-hidden'
            }, React.createElement('div', {
              className: 'h-full bg-blue-500',
              style: { width: `${metrics.efficiency}%` }
            }))
          ]),
          Object.entries(metrics).map(([key, value]) => 
            key !== 'efficiency' && React.createElement('div', { 
              key: `metric-${key}-${loomNo}` 
            }, `${key}: ${value}`)
          )
        ])
      ]);
    }, [getMetadata, getTimelineData, getMetrics]);

    if (isLoading) {
      return React.createElement('div', {
        className: 'flex justify-center items-center h-screen'
      }, 'Loading...');
    }

    if (error) {
      return React.createElement('div', {
        className: 'text-red-500 text-center py-4'
      }, error);
    }

    return React.createElement('div', {
      className: 'container mx-auto p-4'
    }, [
      // Header
      React.createElement('div', {
        key: 'header',
        className: 'sticky top-0 bg-white z-10 p-4 border-b mb-4'
      }, [
        React.createElement('input', {
          key: 'date-input',
          type: 'date',
          value: selectedDate,
          onChange: (e) => setSelectedDate(e.target.value),
          className: 'border rounded p-2'
        })
      ]),
      
      // Loom rows
      React.createElement('div', {
        key: 'content',
        className: 'space-y-4'
      }, Array.from({ length: visibleLooms }, (_, i) => i + 1).map(renderLoomRow)),
      
      // Load more button
      visibleLooms < 150 && React.createElement('button', {
        key: 'load-more',
        onClick: () => setVisibleLooms(prev => Math.min(prev + 10, 150)),
        className: 'mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
      }, 'Load More Looms')
    ]);
  };

  window.GreyProductionDashboard = GreyProductionDashboard;
})(window);