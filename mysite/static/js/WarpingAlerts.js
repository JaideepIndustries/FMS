import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip } from '@/components/ui/tooltip';

const WarpingAlerts = ({ data }) => {
    const [alerts, setAlerts] = React.useState({
        lowProduction: [],
        highBreakages: [],
        highSections: [],
        comments: [],
        longDuration: []
    });

    React.useEffect(() => {
        if (!data) return;

        const now = new Date();
        const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
        const newAlerts = {
            lowProduction: [],
            highBreakages: [],
            highSections: [],
            comments: [],
            longDuration: []
        };

        // Process data by location and machine
        Object.entries(data).forEach(([location, items]) => {
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
                // Calculate daily rates
                const startTime = new Date(`2000-01-01T${item.start_time}`);
                const endTime = new Date(`2000-01-01T${item.end_time}`);
                const durationHours = (endTime - startTime) / (1000 * 60 * 60);
                
                // Convert to daily rates
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
    }, [data]);

    const renderAlert = (title, description, count, items) => {
        if (count === 0) return null;
        
        return (
            <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>
                    {description}
                    <div className="mt-2 text-sm">
                        {items}
                    </div>
                </AlertDescription>
            </Alert>
        );
    };

    return (
        <div className="mb-8">
            {renderAlert(
                "Low Production",
                `${alerts.lowProduction.length} machines produced fewer than 3 beams in 24 hours`,
                alerts.lowProduction.length,
                alerts.lowProduction.map(alert => (
                    <div key={`${alert.location}-${alert.machine}`}>
                        Location {alert.location}, Machine {alert.machine}: {alert.count} beams
                    </div>
                ))
            )}

            {renderAlert(
                "High Breakages",
                `${alerts.highBreakages.length} beams have high breakage rates (>20 per day)`,
                alerts.highBreakages.length,
                alerts.highBreakages.map(alert => (
                    <div key={`${alert.location}-${alert.machine}-${alert.beam}`}>
                        Location {alert.location}, Machine {alert.machine}, Beam {alert.beam}: {alert.value}/day
                    </div>
                ))
            )}

            {renderAlert(
                "High Sections",
                `${alerts.highSections.length} beams have high section counts (>30 per day)`,
                alerts.highSections.length,
                alerts.highSections.map(alert => (
                    <div key={`${alert.location}-${alert.machine}-${alert.beam}`}>
                        Location {alert.location}, Machine {alert.machine}, Beam {alert.beam}: {alert.value}/day
                    </div>
                ))
            )}

            {renderAlert(
                "Comments Present",
                `${alerts.comments.length} beams have comments`,
                alerts.comments.length,
                alerts.comments.map(alert => (
                    <div key={`${alert.location}-${alert.machine}-${alert.beam}`} className="flex items-center">
                        <span>Location {alert.location}, Machine {alert.machine}, Beam {alert.beam}</span>
                        <Tooltip content={alert.comment}>
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-sm font-bold text-white bg-gray-500 rounded-full cursor-help">
                                ?
                            </span>
                        </Tooltip>
                    </div>
                ))
            )}

            {renderAlert(
                "Long Duration",
                `${alerts.longDuration.length} beams took longer than 8 hours to complete`,
                alerts.longDuration.length,
                alerts.longDuration.map(alert => (
                    <div key={`${alert.location}-${alert.machine}-${alert.beam}`}>
                        Location {alert.location}, Machine {alert.machine}, Beam {alert.beam}: {alert.duration} hours
                    </div>
                ))
            )}
        </div>
    );
};

export default WarpingAlerts;