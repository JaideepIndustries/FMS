import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import _ from 'lodash';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Process status colors 
const STATUS_COLORS = {
  'Beam Start': '#90cdf4',
  'Knotting / Drawing Start': '#9ae6b4',
  'Knotting / Drawing End': '#9ae6b4', 
  'Getting Start': '#fbd38d',
  'Getting End': '#fbd38d',
  'QC Start': '#feb2b2',
  'QC End': '#feb2b2',
  'Beam End': '#e9d8fd'
};

const STATUS_ABBREVIATIONS = {
  'Beam Start': 'BS',
  'Knotting / Drawing Start': 'BKD',
  'Getting Start': 'BG',
  'QC Start': 'BQC', 
  'Beam End': 'BE'
};

const GreyEfficiencyDashboard = () => {
  const [data, setData] = useState({
    orderbook: [],
    warpingProduction: [],
    initiateBeam: [],
    beamOnLoom: [],
    greyProduction: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all required data
        const [orderbook, warpingProduction, initiateBeam, beamOnLoom, greyProduction] = 
          await Promise.all([
            fetch('/api/orderbook').then(res => res.json()),
            fetch('/api/warping-production').then(res => res.json()),
            fetch('/api/initiate-beam').then(res => res.json()),
            fetch('/api/beam-on-loom').then(res => res.json()), 
            fetch('/api/unit259-production').then(res => res.json())
          ]);

        setData({
          orderbook,
          warpingProduction,
          initiateBeam,
          beamOnLoom,
          greyProduction: greyProduction.filter(record => record.location === '259/1')
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const getLoomMetadata = (loomNo) => {
    // Get latest beam for this loom
    const latestBeam = _.chain(data.initiateBeam)
      .filter(record => record.loom_no === loomNo)
      .maxBy('timestamp')
      .value();

    if (!latestBeam) return null;

    // Get order details
    const orderDetails = data.orderbook.find(order => 
      order['Design No.'] === latestBeam.design_no
    );

    if (!orderDetails) return null;

    // Calculate grey production
    const totalProduction = _.sumBy(
      data.greyProduction.filter(record => 
        record.loom_no === loomNo &&
        record.design_no === latestBeam.design_no
      ),
      'production_meters'
    );

    return {
      designNo: latestBeam.design_no,
      reed: orderDetails.Reed,
      ppi: orderDetails.Pick,
      partyName: orderDetails['Party Name'],
      weftShades: orderDetails['Weft Shades'],
      weftCount: orderDetails['Weft Count'],
      totalProduction,
      balanceMeters: orderDetails['Factory Order (Meters)'] - totalProduction
    };
  };

  const getShiftData = (loomNo, shift) => {
    const shiftRecords = data.greyProduction.filter(record =>
      record.loom_no === loomNo && 
      record.shift === shift &&
      new Date(record.date).toDateString() === new Date().toDateString()
    );

    const efficiency = _.meanBy(shiftRecords, 'efficiency') || 0;
    const production = _.sumBy(shiftRecords, 'production_meters') || 0;
    const loss = _.sumBy(shiftRecords, 'loss_meters') || 0;
    const warpBreaks = _.sumBy(shiftRecords, 'warp') || 0;
    const weftBreaks = _.sumBy(shiftRecords, 'weft') || 0;

    const latestRecord = _.maxBy(shiftRecords, 'timestamp');
    
    return {
      efficiency,
      production,
      loss,
      warpBreaks,
      weftBreaks,
      weaver: latestRecord?.weaver_name,
      reliever: latestRecord?.reliever_name,
      foreman: latestRecord?.foreman,
      qc: latestRecord?.qc_checker,
      comments: latestRecord?.comments
    };
  };

  const getTimelineEvents = (loomNo) => {
    return data.beamOnLoom
      .filter(record => 
        record.loom_no === loomNo &&
        new Date(record.timestamp).toDateString() === new Date().toDateString()
      )
      .map(record => ({
        status: record.status,
        time: new Date(record.timestamp).getHours(),
        color: STATUS_COLORS[record.status] || '#cbd5e0',
        label: STATUS_ABBREVIATIONS[record.status] || record.status
      }));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Grey Production Efficiency (Unit 259)</h1>
      
      <div className="space-y-4">
        {/* Generate rows for each loom */}
        {_.range(1, 129).map(loomNo => {
          const metadata = getLoomMetadata(loomNo);
          const dayShift = getShiftData(loomNo, 'Day');
          const nightShift = getShiftData(loomNo, 'Night');
          const timelineEvents = getTimelineEvents(loomNo);

          return (
            <Card key={loomNo} className="w-full">
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-4">
                  {/* Part 1: Loom Metadata */}
                  <div className="col-span-3">
                    <h3 className="font-bold">Loom {loomNo}</h3>
                    {metadata && (
                      <div className="text-sm">
                        <p>Design: {metadata.designNo}</p>
                        <p>Reed: {metadata.reed}</p>
                        <p>PPI: {metadata.ppi}</p>
                        <p>Party: {metadata.partyName}</p>
                        <p>Weft Shades: {metadata.weftShades}</p>
                        <p>Weft Count: {metadata.weftCount}</p>
                        <p>Production: {metadata.totalProduction.toFixed(2)} m</p>
                        <p>Balance: {metadata.balanceMeters.toFixed(2)} m</p>
                      </div>
                    )}
                  </div>

                  {/* Part 2: Day Shift */}
                  <div className="col-span-4">
                    <h4 className="font-semibold">Day Shift (8AM - 8PM)</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[dayShift]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="efficiency" fill="#4299e1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm mt-2">
                      <p>Production: {dayShift.production.toFixed(2)} m</p>
                      <p>Loss: {dayShift.loss.toFixed(2)} m</p>
                      <p>Warp Breaks: {dayShift.warpBreaks}</p>
                      <p>Weft Breaks: {dayShift.weftBreaks}</p>
                      <p>Weaver: {dayShift.weaver}</p>
                      <p>Reliever: {dayShift.reliever}</p>
                      <p>Foreman: {dayShift.foreman}</p>
                      <p>QC: {dayShift.qc}</p>
                      {dayShift.comments && (
                        <p className="italic">"{dayShift.comments}"</p>
                      )}
                    </div>
                  </div>

                  {/* Part 3: Night Shift */}
                  <div className="col-span-4">
                    <h4 className="font-semibold">Night Shift (8PM - 8AM)</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[nightShift]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="efficiency" fill="#4299e1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm mt-2">
                      <p>Production: {nightShift.production.toFixed(2)} m</p>
                      <p>Loss: {nightShift.loss.toFixed(2)} m</p>
                      <p>Warp Breaks: {nightShift.warpBreaks}</p>
                      <p>Weft Breaks: {nightShift.weftBreaks}</p>
                      <p>Weaver: {nightShift.weaver}</p>
                      <p>Reliever: {nightShift.reliever}</p>
                      <p>Foreman: {nightShift.foreman}</p>
                      <p>QC: {nightShift.qc}</p>
                      {nightShift.comments && (
                        <p className="italic">"{nightShift.comments}"</p>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="col-span-1">
                    <div className="h-full flex flex-col justify-between">
                      {timelineEvents.map((event, i) => (
                        <div
                          key={i}
                          className="px-2 py-1 rounded text-xs text-white text-center"
                          style={{ backgroundColor: event.color }}
                        >
                          {event.label}
                          <div className="text-xs">{event.time}:00</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GreyEfficiencyDashboard;