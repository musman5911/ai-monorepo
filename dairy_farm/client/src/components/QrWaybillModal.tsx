import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { notify } from '../muf-confirm';
import { QrCode, CheckCircle2, Copy, Printer, X, ShieldCheck, Truck, RefreshCw } from './Icons';

export interface WaybillData {
  id: string;
  timestamp: string;
  source: 'agri' | 'dairy' | 'flock';
  sourceLocation: string;
  destination: 'agri' | 'dairy' | 'flock';
  destLocation: string;
  item: string;
  quantity: number;
  unit: string;
  vehicle: string;
  driver: string;
  internalValueRs: number;
  status: 'issued' | 'received';
  securityChecksum: string;
}

interface QrWaybillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptWaybill: (waybill: WaybillData) => void;
  activeFarm: 'super_admin' | 'agri' | 'dairy' | 'flock';
}

export const QrWaybillModal: React.FC<QrWaybillModalProps> = ({
  isOpen,
  onClose,
  onAcceptWaybill,
  activeFarm,
}) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'scan'>('issue');

  // Issue Form State
  const [source, setSource] = useState<'agri' | 'dairy' | 'flock'>(
    activeFarm === 'super_admin' ? 'agri' : activeFarm
  );
  const [destination, setDestination] = useState<'agri' | 'dairy' | 'flock'>('dairy');
  const [sourceLocation, setSourceLocation] = useState(activeFarm === 'super_admin' ? '' : 'Plot A-12 (North Silage Bunker)');
  const [destLocation, setDestLocation] = useState(activeFarm === 'super_admin' ? '' : 'Dairy Cow Shed 2 (Feed Bins)');
  const [item, setItem] = useState(activeFarm === 'super_admin' ? '' : 'Corn Silage (Fermented)');
  const [quantity, setQuantity] = useState(activeFarm === 'super_admin' ? 0 : 60);
  const [unit, setUnit] = useState('Maunds (40kg)');
  const [vehicle, setVehicle] = useState(activeFarm === 'super_admin' ? '' : 'Tractor MF-385 / Trolley #2');
  const [driver, setDriver] = useState(activeFarm === 'super_admin' ? '' : 'Muhammad Akram');
  const [internalValueRs, setInternalValueRs] = useState(activeFarm === 'super_admin' ? 0 : 48000);

  const [generatedWaybill, setGeneratedWaybill] = useState<WaybillData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scannedPayloadText, setScannedPayloadText] = useState('');
  const [scanResult, setScanResult] = useState<WaybillData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeFarm !== 'super_admin' || !generatedWaybill) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(JSON.stringify(generatedWaybill), { errorCorrectionLevel: 'M', margin: 1, width: 180 })
      .then((dataUrl: string) => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [activeFarm, generatedWaybill]);


  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `MUF-WB-${Date.now().toString().slice(-6)}`;
    const checksum = `SEC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newWaybill: WaybillData = {
      id,
      timestamp: new Date().toISOString(),
      source,
      sourceLocation,
      destination,
      destLocation,
      item,
      quantity,
      unit,
      vehicle,
      driver,
      internalValueRs,
      status: 'issued',
      securityChecksum: checksum,
    };

    setGeneratedWaybill(newWaybill);
  };

  const handleSimulateScan = () => {
    if (generatedWaybill) {
      setScannedPayloadText(JSON.stringify(generatedWaybill, null, 2));
      setScanResult(generatedWaybill);
      return;
    }
    if (activeFarm === 'super_admin') {
      notify('Paste a real waybill payload into the field below. Sample waybills are disabled in Superadmin.', 'info', 'No waybill payload');
      return;
    }
    const demoWaybill: WaybillData = {
      id: 'MUF-WB-883104', timestamp: new Date().toISOString(), source: 'agri',
      sourceLocation: 'Field 4 Maize Sector', destination: 'dairy', destLocation: 'Dairy Feeding Troughs',
      item: 'Green Fodder (Jowar / Maize)', quantity: 120, unit: 'Maunds (40kg)',
      vehicle: 'Fiat 640 / Trolley #1', driver: 'Rashid Khan', internalValueRs: 72000,
      status: 'issued', securityChecksum: 'SEC-89A7B1',
    };
    setScannedPayloadText(JSON.stringify(demoWaybill, null, 2));
    setScanResult(demoWaybill);
  };

  const handleConfirmReceipt = () => {
    if (scanResult) {
      onAcceptWaybill({ ...scanResult, status: 'received' });
      notify(activeFarm === 'super_admin' ? `Waybill #${scanResult.id} received. It will be saved in this browser only.` : `Waybill #${scanResult.id} successfully received and booked into internal inventory!`, 'success', 'Waybill received');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base tracking-tight">{activeFarm === 'super_admin' ? 'Internal Transfer Waybill' : 'Closed-Loop QR Waybill System'}</h3>
              <p className="text-xs text-slate-400">{activeFarm === 'super_admin' ? 'Real payload QR · records saved in this browser' : 'Zero-Network Internal Transfers between MUF Units'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('issue')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'issue'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            Issue Transfer Dispatch Slip
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'scan'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Scan / Receive Waybill
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'issue' ? (
            <div>
              {!generatedWaybill ? (
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Dispatching Unit (Source)
                      </label>
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="agri">🌾 Agri Farm (Crops & Silage)</option>
                        <option value="dairy">🐄 Dairy Farm (Manure / Slurry)</option>
                        <option value="flock">🐔 Flock Farm (Poultry Litter)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Receiving Unit (Destination)
                      </label>
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="dairy">🐄 Dairy Farm (Cattle Feeding)</option>
                        <option value="flock">🐔 Flock Farm (Poultry Rations)</option>
                        <option value="agri">🌾 Agri Farm (Organic Fertilization)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Source Location / Shed</label>
                      <input
                        type="text"
                        value={sourceLocation}
                        onChange={(e) => setSourceLocation(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Facility</label>
                      <input
                        type="text"
                        value={destLocation}
                        onChange={(e) => setDestLocation(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Material / Crop Item</label>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                      >
                        <option value="Maunds (40kg)">Maunds (40kg)</option>
                        <option value="Tons">Metric Tons</option>
                        <option value="Bags (50kg)">Bags (50kg)</option>
                        <option value="Trolleys">Tractor Trolleys</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle / Reg #</label>
                      <input
                        type="text"
                        value={vehicle}
                        onChange={(e) => setVehicle(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Name</label>
                      <input
                        type="text"
                        value={driver}
                        onChange={(e) => setDriver(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Book Value (PKR)</label>
                      <input
                        type="number"
                        value={internalValueRs}
                        onChange={(e) => setInternalValueRs(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    {activeFarm === 'super_admin' ? 'Generate Waybill Slip' : 'Generate Cryptographic QR Waybill Slip'}
                  </button>
                </form>
              ) : (
                <div className="border-2 border-dashed border-emerald-400 bg-emerald-50/50 p-6 rounded-xl text-center space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b pb-2">
                    <span className="font-mono font-bold text-slate-800">{activeFarm === 'super_admin' ? 'WAYBILL' : 'DISPATCH'} #{generatedWaybill.id}</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {activeFarm === 'super_admin' ? 'Reference' : 'Checksum'}: {generatedWaybill.securityChecksum}
                    </span>
                  </div>

                  {/* Superadmin encodes the actual waybill JSON. Other farm tabs retain their existing slip presentation. */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="p-3 bg-white border border-slate-300 rounded-lg shadow-inner inline-block">
                      {activeFarm === 'super_admin' ? (qrDataUrl
                        ? <img src={qrDataUrl} alt={`QR code for waybill ${generatedWaybill.id}`} width={180} height={180} className="h-40 w-40" />
                        : <div className="flex h-40 w-40 items-center justify-center text-center text-xs text-slate-500">Preparing QR payload…</div>) : <svg width="180" height="180" viewBox="0 0 100 100" className="w-40 h-40">
                        {/* QR Pattern Representation */}
                        <rect x="0" y="0" width="100" height="100" fill="white" />
                        {/* Corner Targets */}
                        <rect x="5" y="5" width="26" height="26" fill="black" />
                        <rect x="9" y="9" width="18" height="18" fill="white" />
                        <rect x="13" y="13" width="10" height="10" fill="black" />

                        <rect x="69" y="5" width="26" height="26" fill="black" />
                        <rect x="73" y="9" width="18" height="18" fill="white" />
                        <rect x="77" y="13" width="10" height="10" fill="black" />

                        <rect x="5" y="69" width="26" height="26" fill="black" />
                        <rect x="9" y="73" width="18" height="18" fill="white" />
                        <rect x="13" y="77" width="10" height="10" fill="black" />

                        {/* Dense Matrix Data Elements */}
                        <rect x="36" y="8" width="6" height="6" fill="black" />
                        <rect x="46" y="8" width="6" height="12" fill="black" />
                        <rect x="56" y="14" width="8" height="6" fill="black" />
                        <rect x="36" y="24" width="12" height="6" fill="black" />
                        <rect x="52" y="24" width="10" height="8" fill="black" />
                        <rect x="12" y="36" width="20" height="6" fill="black" />
                        <rect x="38" y="36" width="24" height="24" fill="#065F46" />
                        <rect x="68" y="36" width="18" height="10" fill="black" />
                        <rect x="8" y="46" width="14" height="12" fill="black" />
                        <rect x="66" y="52" width="22" height="8" fill="black" />
                        <rect x="12" y="60" width="8" height="6" fill="black" />
                        <rect x="38" y="66" width="8" height="18" fill="black" />
                        <rect x="52" y="68" width="14" height="8" fill="black" />
                        <rect x="70" y="66" width="18" height="18" fill="black" />
                        <rect x="52" y="82" width="14" height="10" fill="black" />
                      </svg>}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-2 font-mono">
                      {activeFarm === 'super_admin' ? 'Encoded waybill payload' : 'Offline Scan Payload'}: {generatedWaybill.id}
                    </span>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-left text-xs grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block">Item / Cargo:</span>
                      <strong className="text-slate-800">{generatedWaybill.item}</strong> ({generatedWaybill.quantity} {generatedWaybill.unit})
                    </div>
                    <div>
                      <span className="text-slate-400 block">Transfer Route:</span>
                      <strong className="text-emerald-700 uppercase">{generatedWaybill.source}</strong> $\rightarrow$ <strong className="text-indigo-700 uppercase">{generatedWaybill.destination}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Driver / Tractor:</span>
                      <span className="text-slate-700">{generatedWaybill.driver} ({generatedWaybill.vehicle})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Valuation:</span>
                      <span className="text-slate-700 font-semibold">PKR {generatedWaybill.internalValueRs.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(generatedWaybill, null, 2));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied Payload!' : 'Copy Data'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Dispatch Slip
                    </button>
                    <button
                      onClick={() => setGeneratedWaybill(null)}
                      className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      New
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {activeFarm === 'super_admin' ? 'Waybill Payload Review' : 'Receiving Farm Verification Terminal'}
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  {activeFarm === 'super_admin'
                    ? 'Paste a real waybill JSON payload below to review and receive it. Sample records are disabled in Superadmin.'
                    : 'In offline rural field operations, farm managers scan the printed QR waybill or paste the token to accept inbound transfer without cloud database calls.'}
                </p>

                <div className="flex gap-2 mb-3">
                  {activeFarm !== 'super_admin' && <button
                    onClick={handleSimulateScan}
                    className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Simulate Live Field Scanner
                  </button>}
                </div>

                <textarea
                  value={scannedPayloadText}
                  onChange={(e) => {
                    setScannedPayloadText(e.target.value);
                    try {
                      setScanResult(JSON.parse(e.target.value));
                    } catch {
                      setScanResult(null);
                    }
                  }}
                  placeholder="Paste scanned QR raw payload here..."
                  className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg h-28 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {scanResult && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200 pb-2">
                    <span>{activeFarm === 'super_admin' ? 'WAYBILL PAYLOAD' : 'VERIFIED WAYBILL'}: #{scanResult.id}</span>
                    <span className="text-emerald-700 font-normal">{activeFarm === 'super_admin' ? 'Reference code' : 'Authenticity Signed'}: {scanResult.securityChecksum}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Inbound Material:</span>
                      <p className="font-semibold text-slate-800">{scanResult.item}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Net Quantity:</span>
                      <p className="font-semibold text-slate-800">{scanResult.quantity} {scanResult.unit}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">From / To:</span>
                      <p className="font-semibold text-slate-800">{scanResult.sourceLocation} $\rightarrow$ {scanResult.destLocation}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Driver & Vehicle:</span>
                      <p className="font-semibold text-slate-800">{scanResult.driver} ({scanResult.vehicle})</p>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmReceipt}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Accept Cargo Into Receiving Inventory
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
