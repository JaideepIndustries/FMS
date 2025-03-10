const WarpingDashboard = () => {
    const [data, setData] = React.useState({});
    const [expandedLocations, setExpandedLocations] = React.useState(new Set());
    const [expandedMachines, setExpandedMachines] = React.useState(new Set());
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [alerts, setAlerts] = React.useState({
        lowProduction: [],
        highBreakages: [],
        highSections: [],
        comments: [],
        longDuration: []
    });

    const calculateDaysLeft = (deliveryDateStr) => {
        if (!deliveryDateStr) return null;
        try {
            // Convert delivery date to Date object
            const deliveryDate = new Date(deliveryDateStr);
            // Get current date with time set to midnight
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (isNaN(deliveryDate.getTime())) {
                console.log('Invalid delivery date:', deliveryDateStr);
                return null;
            }
            
            // Calculate difference in days
            const diffTime = deliveryDate.getTime() - today.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('Error calculating days left:', error);
            return null;
        }
    };

    const renderDaysLeft = (daysLeft) => {
        if (daysLeft === null || daysLeft === undefined) return '-';
        return daysLeft >= 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`;
    };

    // Calculate totals for a set of items
    const calculateTotals = (items) => ({
        quantity: _.sumBy(items, 'quantity'),
        breakages: _.sumBy(items, 'breakages'),
        sections: _.sumBy(items, 'sections'),
        order_quantity: _.sumBy(items, 'order_quantity'),
        balance: _.sumBy(items, 'balance')
    });

    // Toggle functions
    const toggleLocation = (location) => {
        const newExpanded = new Set(expandedLocations);
        if (newExpanded.has(location)) {
            newExpanded.delete(location);
            setExpandedMachines(new Set([...expandedMachines].filter(m => !m.startsWith(location + '-'))));
        } else {
            newExpanded.add(location);
        }
        setExpandedLocations(newExpanded);
    };

    const toggleMachine = (locationMachineKey) => {
        const newExpanded = new Set(expandedMachines);
        if (newExpanded.has(locationMachineKey)) {
            newExpanded.delete(locationMachineKey);
        } else {
            newExpanded.add(locationMachineKey);
        }
        setExpandedMachines(newExpanded);
    };
    
// Calculate alerts based on current data
    const calculateAlerts = (processedData) => {
        const now = new Date();
        const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
        const newAlerts = {
            lowProduction: [],
            highBreakages: [],
            highSections: [],
            comments: [],
            longDuration: []
        };

        Object.entries(processedData).forEach(([location, items]) => {
            const groupedByMachine = _.groupBy(items, 'machine_no');

            // Check beams per machine in last 24 hours
            Object.entries(groupedByMachine).forEach(([machine, machineItems]) => {
                const recentBeams = machineItems.filter(item => {
                    const endTime = new Date(`${now.toISOString().split('T')[0]}T${item.end_time}`);
                    return endTime > last24Hours;
                });

                if (recentBeams.length < 3) {
                    newAlerts.lowProduction.push({
                        location,
                        machine,
                        count: recentBeams.length
                    });
                }
            });

            // Check other alerts for each beam
            items.forEach(item => {
                const startTime = new Date(`2000-01-01T${item.start_time}`);
                const endTime = new Date(`2000-01-01T${item.end_time}`);
                const durationHours = (endTime - startTime) / (1000 * 60 * 60);
                
                const breakagesPerDay = (item.breakages / durationHours) * 24;
                const sectionsPerDay = (item.sections / durationHours) * 24;

                if (breakagesPerDay > 20) {
                    newAlerts.highBreakages.push({
                        location,
                        machine: item.machine_no,
                        beam: item.beam_no,
                        value: Math.round(breakagesPerDay)
                    });
                }

                if (sectionsPerDay > 30) {
                    newAlerts.highSections.push({
                        location,
                        machine: item.machine_no,
                        beam: item.beam_no,
                        value: Math.round(sectionsPerDay)
                    });
                }

                if (item.comments) {
                    newAlerts.comments.push({
                        location,
                        machine: item.machine_no,
                        beam: item.beam_no,
                        comment: item.comments
                    });
                }

                if (durationHours > 8) {
                    newAlerts.longDuration.push({
                        location,
                        machine: item.machine_no,
                        beam: item.beam_no,
                        duration: Math.round(durationHours)
                    });
                }
            });
        });

        setAlerts(newAlerts);
    };

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [warpingResponse, orderbookResponse] = await Promise.all([
                    fetch('/api/data/warping_production'),
                    fetch('/api/data/orderbook')
                ]);

                if (!warpingResponse.ok || !orderbookResponse.ok) {
                    throw new Error('Failed to fetch data');
                }

                const warpingData = await warpingResponse.json();
                const orderbookData = await orderbookResponse.json();

                const orderbookLookup = _.keyBy(orderbookData, 'Design No.');
                const processedData = {};

                warpingData.forEach(prod => {
                    const orderData = orderbookLookup[prod.design_no] || {};
                    const location = orderData['Warping Location'] || 'Unknown';

                    if (!processedData[location]) {
                        processedData[location] = [];
                    }

                    const startTime = new Date(`2000-01-01T${prod.start_time}`);
                    const endTime = new Date(`2000-01-01T${prod.end_time}`);
                    const totalMinutes = (endTime - startTime) / (1000 * 60);
                    const daysLeft = calculateDaysLeft(orderData['Delivery Date']);

                    processedData[location].push({
                        machine_no: prod.machine_no,
                        beam_no: prod.beam_no,
                        order_no: orderData['Order No.'] || '',
                        combo_no: orderData['Combo No.'] || '',
                        design_no: prod.design_no,
                        quantity: prod.quantity,
                        start_time: prod.start_time,
                        end_time: prod.end_time,
                        total_time: `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60).toString().padStart(2, '0')}`,
                        breakages: prod.breakages,
                        sections: prod.sections,
                        comments: prod.comments,
                        warper_name: prod.warper_name,
                        days_left: daysLeft,
                        order_quantity: orderData['Quantity (Meters)'] || 0,
                        balance: (orderData['Quantity (Meters)'] || 0) - prod.quantity,
                        reed: orderData['Reed'] || '',
                        weft_count: orderData['Weft Count'] || '',
                        weft_shades: orderData['Weft Shades'] || '',
                        shaft: orderData['Shafts'] || ''
                    });
                });

                setData(processedData);
                calculateAlerts(processedData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Error loading dashboard data');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

const renderAlert = (title, description, count, items) => {
        if (count === 0) return null;
        
        return React.createElement('div', { className: "bg-white rounded-lg shadow-md p-4 mb-4" },
            React.createElement('div', { className: "flex items-center" },
                React.createElement('div', { className: "flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center" },
                    React.createElement('span', { className: "text-red-600 text-xl font-bold" }, count)
                ),
                React.createElement('div', { className: "ml-4" },
                    React.createElement('h3', { className: "text-lg font-semibold text-red-600" }, title),
                    React.createElement('p', { className: "text-sm text-gray-600" }, description)
                )
            ),
            React.createElement('div', { className: "mt-3 space-y-2" }, items)
        );
    };

    const renderAlerts = () => {
        return React.createElement('div', { className: "mb-8 space-y-4" },
            renderAlert(
                "Low Production",
                `${alerts.lowProduction.length} machines produced fewer than 3 beams in 24 hours`,
                alerts.lowProduction.length,
                alerts.lowProduction.map(alert => 
                    React.createElement('div', { 
                        key: `${alert.location}-${alert.machine}`,
                        className: "text-sm text-gray-600 pl-16"
                    }, `Location ${alert.location}, Machine ${alert.machine}: ${alert.count} beams`)
                )
            ),
            renderAlert(
                "High Breakages",
                `${alerts.highBreakages.length} beams have high breakage rates (>20 per day)`,
                alerts.highBreakages.length,
                alerts.highBreakages.map(alert => 
                    React.createElement('div', { 
                        key: `${alert.location}-${alert.machine}-${alert.beam}`,
                        className: "text-sm text-gray-600 pl-16"
                    }, `Location ${alert.location}, Machine ${alert.machine}, Beam ${alert.beam}: ${alert.value}/day`)
                )
            ),
            renderAlert(
                "High Sections",
                `${alerts.highSections.length} beams have high section counts (>30 per day)`,
                alerts.highSections.length,
                alerts.highSections.map(alert => 
                    React.createElement('div', { 
                        key: `${alert.location}-${alert.machine}-${alert.beam}`,
                        className: "text-sm text-gray-600 pl-16"
                    }, `Location ${alert.location}, Machine ${alert.machine}, Beam ${alert.beam}: ${alert.value}/day`)
                )
            ),
            renderAlert(
                "Comments Present",
                `${alerts.comments.length} beams have comments`,
                alerts.comments.length,
                alerts.comments.map(alert => 
                    React.createElement('div', { 
                        key: `${alert.location}-${alert.machine}-${alert.beam}`,
                        className: "text-sm text-gray-600 pl-16 flex items-center"
                    },
                        React.createElement('span', null, 
                            `Location ${alert.location}, Machine ${alert.machine}, Beam ${alert.beam}`
                        ),
                        React.createElement('div', {
                            className: "ml-2 w-5 h-5 rounded-full bg-gray-500 text-white flex items-center justify-center cursor-help relative group",
                            title: alert.comment
                        }, "?")
                    )
                )
            ),
            renderAlert(
                "Long Duration",
                `${alerts.longDuration.length} beams took longer than 8 hours to complete`,
                alerts.longDuration.length,
                alerts.longDuration.map(alert => 
                    React.createElement('div', { 
                        key: `${alert.location}-${alert.machine}-${alert.beam}`,
                        className: "text-sm text-gray-600 pl-16"
                    }, `Location ${alert.location}, Machine ${alert.machine}, Beam ${alert.beam}: ${alert.duration} hours`)
                )
            )
        );
    };

if (loading) {
        return React.createElement('div', { className: "flex items-center justify-center h-64" },
            React.createElement('div', { className: "text-lg text-gray-600" }, "Loading dashboard data...")
        );
    }

    if (error) {
        return React.createElement('div', { className: "flex items-center justify-center h-64" },
            React.createElement('div', { className: "text-lg text-red-600" }, error)
        );
    }

    const columns = [
        { key: 'identifier', label: 'Location/Machine/Beam' },
        { key: 'order_no', label: 'Order No.' },
        { key: 'combo_no', label: 'Combo No.' },
        { key: 'design_no', label: 'Design No.' },
        { key: 'quantity', label: 'Quantity (Meters)' },
        { key: 'total_time', label: 'Total Time' },
        { key: 'breakages', label: 'Breakages' },
        { key: 'sections', label: 'Sections' },
        { key: 'warper_name', label: 'Warper Name' },
        { key: 'days_left', label: 'Days Left' },
        { key: 'order_quantity', label: 'Order Qty' },
        { key: 'balance', label: 'Balance' },
        { key: 'reed', label: 'Reed' },
        { key: 'weft_count', label: 'Weft Count' },
        { key: 'weft_shades', label: 'Weft Shades' },
        { key: 'shaft', label: 'Shaft' }
    ];

    const renderTotalRow = (totals, prefix = '') => {
        return React.createElement('tr', { className: "bg-gray-100" },
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" }, `${prefix}Total`),
            React.createElement('td', { className: "px-6 py-4" }, ''), // Order No
            React.createElement('td', { className: "px-6 py-4" }, ''), // Combo No
            React.createElement('td', { className: "px-6 py-4" }, ''), // Design No
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" },
                Math.round(totals.quantity)
            ),
            React.createElement('td', { className: "px-6 py-4" }, ''), // Total Time
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" },
                totals.breakages
            ),
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" },
                totals.sections
            ),
            React.createElement('td', { className: "px-6 py-4" }, ''), // Warper Name
            React.createElement('td', { className: "px-6 py-4" }, ''), // Days Left
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" },
                Math.round(totals.order_quantity)
            ),
            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold" },
                Math.round(totals.balance)
            ),
            React.createElement('td', { className: "px-6 py-4" }, ''), // Reed
            React.createElement('td', { className: "px-6 py-4" }, ''), // Weft Count
            React.createElement('td', { className: "px-6 py-4" }, ''), // Weft Shades
            React.createElement('td', { className: "px-6 py-4" }, '')  // Shaft
        );
    };

    const renderTableBody = () => {
        const rows = [];

        Object.entries(data).forEach(([location, items]) => {
            const locationTotals = calculateTotals(items);
            const groupedByMachine = _.groupBy(items, 'machine_no');

            // Location row
            rows.push(React.createElement('tr', {
                key: location,
                className: "bg-blue-50 cursor-pointer hover:bg-blue-100",
                onClick: () => toggleLocation(location)
            },
                React.createElement('td', { colSpan: 16, className: "px-6 py-4" },
                    React.createElement('div', { className: "flex items-center" },
                        React.createElement('span', { className: "mr-2" },
                            expandedLocations.has(location) ? '▼' : '▶'
                        ),
                        React.createElement('span', { className: "font-medium" },
                            `Location: ${location} (${items.length} beams)`
                        )
                    )
                )
            ));

            if (expandedLocations.has(location)) {
                // Location totals
                rows.push(renderTotalRow(locationTotals, 'Location '));

                // Machine rows
                Object.entries(groupedByMachine).forEach(([machine, machineItems]) => {
                    const machineTotals = calculateTotals(machineItems);
                    const locationMachineKey = `${location}-${machine}`;

                    rows.push(React.createElement('tr', {
                        key: locationMachineKey,
                        className: "bg-green-50 cursor-pointer hover:bg-green-100",
                        onClick: () => toggleMachine(locationMachineKey)
                    },
                        React.createElement('td', { colSpan: 16, className: "px-6 py-4 pl-8" },
                            React.createElement('div', { className: "flex items-center" },
                                React.createElement('span', { className: "mr-2" },
                                    expandedMachines.has(locationMachineKey) ? '▼' : '▶'
                                ),
                                React.createElement('span', null,
                                    `Machine ${machine} (${machineItems.length} beams)`
                                )
                            )
                        )
                    ));

                    if (expandedMachines.has(locationMachineKey)) {
                        // Machine totals
                        rows.push(renderTotalRow(machineTotals, 'Machine '));

                        // Beam rows
                        machineItems.forEach(item => {
                            rows.push(React.createElement('tr', {
                                key: `${locationMachineKey}-${item.beam_no}`,
                                className: "hover:bg-gray-50"
                            },
                                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm pl-12" },
                                    `Beam ${item.beam_no}`
                                ),
                                ...columns.slice(1).map(col =>
                                    React.createElement('td', {
                                        key: col.key,
                                        className: col.key === 'days_left' ?
                                            `px-6 py-4 whitespace-nowrap text-sm ${item[col.key] < 0 ? 'text-red-600' : 'text-green-600'}` :
                                            "px-6 py-4 whitespace-nowrap text-sm"
                                    },
                                        col.key === 'days_left' ? renderDaysLeft(item[col.key]) : item[col.key]
                                    )
                                )
                            ));
                        });
                    }
                });
            }
        });

        return rows;
    };

    return React.createElement('div', { className: "w-full" },
        renderAlerts(),
        React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                React.createElement('thead', { className: "bg-gray-50" },
                    React.createElement('tr', null,
                        columns.map(col =>
                            React.createElement('th', {
                                key: col.key,
                                className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            }, col.label)
                        )
                    )
                ),
                React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                    renderTableBody()
                )
            )
        )
    );
};

window.WarpingDashboard = WarpingDashboard;



