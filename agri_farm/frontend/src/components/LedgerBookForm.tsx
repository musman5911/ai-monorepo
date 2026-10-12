import React, { useEffect, useState } from 'react';
import { CheckCircle, Droplets, FileText, FlaskConical, HardHat, Leaf, Trash2 } from 'lucide-react';
import * as api from '../api';
import ImageUploader from './ImageUploader';
import { useConfirm } from '../muf-confirm';
import { L } from '../i18n';

const fieldClass = 'w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500';
const labelClass = 'block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider';
const LEDGER_EXPENSE_CATS = ['Seed', 'Cultivator', 'Hal (Plough)'];

const BOOK_TABS = [
  { id: 'ledger', label: 'Ledger', icon: FileText },
  { id: 'irrigation', label: 'Irrigation', icon: Droplets },
  { id: 'spray', label: 'Spray', icon: FlaskConical },
  { id: 'labor', label: 'Labor', icon: HardHat },
  { id: 'fertilizer', label: 'Fertilizer', icon: Leaf },
];

export default function LedgerBookForm({
  open,
  tab,
  onTabChange,
  finForm,
  setFinForm,
  handleFinanceFieldChange,
  handleFinanceSubmit,
  editingFinance,
  crops = [],
  inventory = [],
  suppliers = [],
  onCancel,
  formatCurrency,
  compressAndConvertToBase64,
  showAlert,
  refreshData
}) {
  const confirm = useConfirm();
  const [irrigationRows, setIrrigationRows] = useState([]);
  const [sprayRows, setSprayRows] = useState([]);
  const [opsBusy, setOpsBusy] = useState(false);
  const pesticides = inventory.filter(item => item.category === 'pesticide');
  const rentedTotal = (parseFloat(finForm.hours) || 0) * (parseFloat(finForm.hourly_rate) || 0);

  const loadOps = async () => {
    try {
      const [irrRes, sprayRes] = await Promise.all([api.getIrrigation(), api.getSprayLogs()]);
      setIrrigationRows(irrRes.data || []);
      setSprayRows(sprayRes.data || []);
    } catch (err) {
      console.warn('Failed to load irrigation/spray logs:', err);
    }
  };

  useEffect(() => {
    if (open && (tab === 'irrigation' || tab === 'spray')) loadOps();
  }, [open, tab]);

  const switchTab = (id) => {
    if (editingFinance && (id === 'irrigation' || id === 'spray')) return;
    if (id === 'labor') setFinForm(prev => ({ ...prev, type: 'expense', category: 'Labor' }));
    else if (id === 'fertilizer') setFinForm(prev => ({ ...prev, type: 'expense', category: 'Fertilizer' }));
    else if (id === 'irrigation') setFinForm(prev => ({
      ...prev,
      type: 'expense',
      category: 'Irrigation',
      tubewell: prev.tubewell || 'rented',
      hourly_rate: prev.hourly_rate && parseFloat(prev.hourly_rate) > 0 ? prev.hourly_rate : '800'
    }));
    else if (id === 'spray') setFinForm(prev => ({ ...prev, type: 'expense' }));
    onTabChange(id);
  };

  const cropLabel = (cropId) => crops.find(c => c._id === cropId)?.name || 'Crop';

  const handleDeleteIrrigation = async (id) => {
    const ok = await confirm({
      title: L('Remove Irrigation Log'),
      message: L('Delete this irrigation entry? Any ledger charge it created stays until removed from the ledger.'),
      confirmLabel: L('Delete'),
      tone: 'danger',
    });
    if (!ok) return;
    setOpsBusy(true);
    try {
      await api.deleteIrrigation(id);
      showAlert('Irrigation log removed.');
      await loadOps();
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove irrigation.', true);
    } finally {
      setOpsBusy(false);
    }
  };

  const handleDeleteSpray = async (id) => {
    const ok = await confirm({
      title: L('Remove Spray Log'),
      message: L('Delete this spray entry?'),
      confirmLabel: L('Delete'),
      tone: 'danger',
    });
    if (!ok) return;
    setOpsBusy(true);
    try {
      await api.deleteSprayLog(id);
      showAlert('Spray log removed.');
      await loadOps();
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove spray.', true);
    } finally {
      setOpsBusy(false);
    }
  };

  const submitLabel = () => {
    if (editingFinance) return 'Update Ledger';
    if (tab === 'irrigation') return 'Log irrigation';
    if (tab === 'spray') return 'Log spray';
    if (tab === 'labor') return 'Log labor';
    if (tab === 'fertilizer') return 'Log fertilizer';
    return 'Record Book Log';
  };

  return (
    <form onSubmit={handleFinanceSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {BOOK_TABS.map(({ id, label, icon: Icon }) => {
          const locked = !!editingFinance && (id === 'irrigation' || id === 'spray');
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => switchTab(id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-colors ${
                active
                  ? 'bg-farm-600 text-white border-farm-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon size={12} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'ledger' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Ledger Flow *</label>
              <select
                className={fieldClass}
                value={finForm.type}
                onChange={e => setFinForm({ ...finForm, type: e.target.value, category: e.target.value === 'income' ? 'Harvest Sale' : '' })}
              >
                <option value="expense">{L('Expenditure / Outflow (-)')}</option>
                <option value="income">{L('Revenue / Inflow (+)')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Amount (Rs.) *</label>
              <input required={finForm.type === 'income' || !LEDGER_EXPENSE_CATS.includes(finForm.category)} type="number" step="0.01" className={fieldClass} value={finForm.amount} onChange={e => setFinForm({ ...finForm, amount: e.target.value })} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Item Description / Category *</label>
            {finForm.type === 'income' ? (
              <>
                <select
                  className={`${fieldClass} mb-2`}
                  value={['Harvest Sale', 'Crop Sale', 'Subsidy'].includes(finForm.category) ? finForm.category : 'Custom'}
                  onChange={e => {
                    const val = e.target.value;
                    setFinForm({ ...finForm, category: val === 'Custom' ? '' : val });
                  }}
                >
                  <option value="Harvest Sale">{L('Harvest Sale')}</option>
                  <option value="Crop Sale">{L('Crop Sale')}</option>
                  <option value="Subsidy">{L('Subsidy')}</option>
                  <option value="Custom">{L('Custom / Other Income')}</option>
                </select>
                {(!['Harvest Sale', 'Crop Sale', 'Subsidy'].includes(finForm.category) || finForm.category === '') && (
                  <input required className={fieldClass} value={finForm.category} onChange={e => setFinForm({ ...finForm, category: e.target.value })} placeholder={L('Enter income category...')} />
                )}
              </>
            ) : (
              <>
                <select
                  className={`${fieldClass} mb-2`}
                  value={LEDGER_EXPENSE_CATS.includes(finForm.category) ? finForm.category : 'Custom'}
                  onChange={e => {
                    const val = e.target.value;
                    setFinForm({ ...finForm, category: val === 'Custom' ? '' : val });
                  }}
                >
                  <option value="Seed">{L('Seed')}</option>
                  <option value="Cultivator">{L('Cultivator')}</option>
                  <option value="Hal (Plough)">{L('Hal (Plough)')}</option>
                  <option value="Custom">{L('Custom / Other Category')}</option>
                </select>
                {(!LEDGER_EXPENSE_CATS.includes(finForm.category) || finForm.category === '') && (
                  <input required className={fieldClass} value={finForm.category} onChange={e => setFinForm({ ...finForm, category: e.target.value })} placeholder={L('Enter custom category description...')} />
                )}
              </>
            )}
          </div>

          {finForm.type === 'income' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-farm-200 dark:border-farm-900/40 bg-farm-50/60 dark:bg-farm-950/20">
              <div>
                <label className={labelClass}>{L('Buyer Name')}</label>
                <input className={fieldClass} value={finForm.buyer_name} onChange={e => setFinForm({ ...finForm, buyer_name: e.target.value })} placeholder={L('e.g. Local mandi')} />
              </div>
              <div>
                <label className={labelClass}>{L('Qty Sold')}</label>
                <input type="number" step="any" min="0" className={fieldClass} value={finForm.quantity_sold} onChange={e => handleFinanceFieldChange('quantity_sold', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>{L('Rate / Unit (Rs.)')}</label>
                <input type="number" step="any" min="0" className={fieldClass} value={finForm.rate_per_unit} onChange={e => handleFinanceFieldChange('rate_per_unit', e.target.value)} placeholder="0" />
              </div>
            </div>
          )}

          {finForm.type === 'expense' && (
            <div>
              <label className={labelClass}>Supplier — udhaar khata (optional)</label>
              <select className={fieldClass} value={finForm.supplier_id || ''} onChange={e => setFinForm({ ...finForm, supplier_id: e.target.value })}>
                <option value="">{L('Cash / no supplier')}</option>
                {suppliers.map(sup => <option key={sup._id} value={sup._id}>{sup.name}</option>)}
              </select>
            </div>
          )}

          {finForm.type === 'expense' && finForm.category === 'Seed' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Seed Quantity (kg) *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.seed_qty_kg || ''} onChange={e => handleFinanceFieldChange('seed_qty_kg', e.target.value)} placeholder="e.g. 50" />
              </div>
              <div>
                <label className={labelClass}>Price per kg (Rs.) *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.seed_price_per_kg || ''} onChange={e => handleFinanceFieldChange('seed_price_per_kg', e.target.value)} placeholder="e.g. 120" />
              </div>
            </div>
          )}

          {finForm.type === 'expense' && finForm.category === 'Hal (Plough)' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Hours Ploughed *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.plough_hours || ''} onChange={e => handleFinanceFieldChange('plough_hours', e.target.value)} placeholder="e.g. 5" />
              </div>
              <div>
                <label className={labelClass}>Hourly Rate *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.hourly_rate || ''} onChange={e => handleFinanceFieldChange('hourly_rate', e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div>
                <label className={labelClass}>{L('Petrol / Fuel Cost')}</label>
                <input type="number" step="any" className={fieldClass} value={finForm.fuel_cost || ''} onChange={e => handleFinanceFieldChange('fuel_cost', e.target.value)} placeholder="e.g. 1000" />
              </div>
            </div>
          )}

          {finForm.type === 'expense' && finForm.category === 'Cultivator' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Hours Cultivated *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.cultivator_hours || ''} onChange={e => handleFinanceFieldChange('cultivator_hours', e.target.value)} placeholder="e.g. 4" />
              </div>
              <div>
                <label className={labelClass}>Hourly Rate *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.hourly_rate || ''} onChange={e => handleFinanceFieldChange('hourly_rate', e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div>
                <label className={labelClass}>{L('Petrol / Fuel Cost')}</label>
                <input type="number" step="any" className={fieldClass} value={finForm.fuel_cost || ''} onChange={e => handleFinanceFieldChange('fuel_cost', e.target.value)} placeholder="e.g. 800" />
              </div>
            </div>
          )}

          {finForm.type === 'expense' && !LEDGER_EXPENSE_CATS.includes(finForm.category) && finForm.category !== '' && !['Labor', 'Fertilizer', 'Irrigation'].includes(finForm.category) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Unit Quantity *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.custom_qty || ''} onChange={e => handleFinanceFieldChange('custom_qty', e.target.value)} placeholder="e.g. 5" />
              </div>
              <div>
                <label className={labelClass}>Price per Unit (Rs) *</label>
                <input required type="number" step="any" className={fieldClass} value={finForm.custom_price || ''} onChange={e => handleFinanceFieldChange('custom_price', e.target.value)} placeholder="e.g. 500" />
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'irrigation' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">Rented tubewell posts hours × hourly rate to the Irrigation ledger. Own solar stores hours only — no diesel and no ledger charge.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Crop *</label>
              <select required className={fieldClass} value={finForm.crop_id === 'farm-wide' ? '' : finForm.crop_id} onChange={e => setFinForm({ ...finForm, crop_id: e.target.value || 'farm-wide' })}>
                <option value="">{L('Select crop')}</option>
                {crops.map(c => <option key={c._id} value={c._id}>{c.name} ({c.status})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input required type="date" className={fieldClass} value={finForm.date || ''} onChange={e => setFinForm({ ...finForm, date: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Hours *</label>
              <input required type="number" step="any" min="0" className={fieldClass} value={finForm.hours || ''} onChange={e => setFinForm({ ...finForm, hours: e.target.value })} placeholder="e.g. 4" />
            </div>
            <div>
              <label className={labelClass}>Tubewell *</label>
              <select className={fieldClass} value={finForm.tubewell || 'rented'} onChange={e => setFinForm({ ...finForm, tubewell: e.target.value })}>
                <option value="rented">Rented — hours × rate</option>
                <option value="own">Own solar — hours only</option>
              </select>
            </div>
            {(finForm.tubewell || 'rented') === 'rented' && (
              <div>
                <label className={labelClass}>Hourly rate (Rs.) *</label>
                <input required type="number" step="any" min="0" className={fieldClass} value={finForm.hourly_rate || ''} onChange={e => setFinForm({ ...finForm, hourly_rate: e.target.value })} />
              </div>
            )}
          </div>
          {(finForm.tubewell || 'rented') === 'rented' && parseFloat(finForm.hours) > 0 && (
            <p className="text-[11px] font-bold text-farm-700 dark:text-farm-400">Ledger charge: Rs. {formatCurrency(rentedTotal)}</p>
          )}
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {irrigationRows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No irrigation hours yet.')}</p>}
            {irrigationRows.slice().reverse().slice(0, 8).map(row => (
              <div key={row._id} className="flex justify-between items-start gap-2 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/40 text-xs">
                <div>
                  <p className="font-bold">{row.date} · {cropLabel(row.crop_id)} · {row.hours}h · {row.tubewell === 'rented' ? 'Rented' : 'Own solar'}</p>
                  <p className="text-[10px] text-slate-500">
                    {row.tubewell === 'rented' ? `Rs. ${formatCurrency(row.amount || 0)} (${row.hours} × ${row.hourly_rate})` : 'Hours only — no ledger charge'}
                  </p>
                </div>
                <button type="button" disabled={opsBusy} onClick={() => handleDeleteIrrigation(row._id)} className="text-slate-400 hover:text-red-500" aria-label={L('Delete irrigation')}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'spray' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Crop *</label>
              <select required className={fieldClass} value={finForm.crop_id === 'farm-wide' ? '' : finForm.crop_id} onChange={e => setFinForm({ ...finForm, crop_id: e.target.value || 'farm-wide' })}>
                <option value="">{L('Select crop')}</option>
                {crops.map(c => <option key={c._id} value={c._id}>{c.name} ({c.status})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input required type="date" className={fieldClass} value={finForm.date || ''} onChange={e => setFinForm({ ...finForm, date: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Chemical *</label>
              <input required className={fieldClass} value={finForm.chemical || ''} onChange={e => setFinForm({ ...finForm, chemical: e.target.value })} placeholder={L('e.g. Lambda')} />
            </div>
            <div>
              <label className={labelClass}>{L('Dose')}</label>
              <input className={fieldClass} value={finForm.dose || ''} onChange={e => setFinForm({ ...finForm, dose: e.target.value })} placeholder={L('e.g. 0.5 L / acre')} />
            </div>
            <div>
              <label className={labelClass}>{L('Deduct inventory')}</label>
              <select className={fieldClass} value={finForm.inventory_item_id || ''} onChange={e => setFinForm({ ...finForm, inventory_item_id: e.target.value })}>
                <option value="">{L('No stock deduct')}</option>
                {pesticides.map(item => (
                  <option key={item._id} value={item._id}>{item.name} ({item.current_stock} {item.unit})</option>
                ))}
              </select>
            </div>
            {finForm.inventory_item_id && (
              <div>
                <label className={labelClass}>{L('Qty consumed')}</label>
                <input type="number" step="any" min="0" className={fieldClass} value={finForm.inventory_qty_consumed || ''} onChange={e => setFinForm({ ...finForm, inventory_qty_consumed: e.target.value })} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImageUploader
              label={L('Optional photo')}
              value={finForm.spray_image}
              onDone={(base64) => setFinForm(prev => ({ ...prev, spray_image: base64 }))}
              onRemove={() => setFinForm(prev => ({ ...prev, spray_image: '' }))}
            />
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {sprayRows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No spray logs yet.')}</p>}
            {sprayRows.slice().reverse().slice(0, 8).map(row => (
              <div key={row._id} className="flex justify-between items-start gap-2 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/40 text-xs">
                <div className="min-w-0">
                  <p className="font-bold">{row.date} · {cropLabel(row.crop_id)} · {row.chemical}</p>
                  <p className="text-[10px] text-slate-500">{row.dose || 'Dose not set'}{row.inventory_deducted ? ` · deducted ${row.inventory_qty_consumed}` : ''}</p>
                  {row.notes && <p className="text-[10px] text-slate-500 italic">{row.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.image_base64 && <img src={row.image_base64} alt="" className="w-8 h-8 rounded object-cover" />}
                  <button type="button" disabled={opsBusy} onClick={() => handleDeleteSpray(row._id)} className="text-slate-400 hover:text-red-500" aria-label={L('Delete spray')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'labor' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>No. of Workers *</label>
            <input required type="number" step="any" className={fieldClass} value={finForm.labor_workers || ''} onChange={e => handleFinanceFieldChange('labor_workers', e.target.value)} placeholder="e.g. 3" />
          </div>
          <div>
            <label className={labelClass}>Days Worked *</label>
            <input required type="number" step="any" className={fieldClass} value={finForm.labor_days || ''} onChange={e => handleFinanceFieldChange('labor_days', e.target.value)} placeholder="e.g. 6" />
          </div>
          <div>
            <label className={labelClass}>Daily Wage (Rs) *</label>
            <input required type="number" step="any" className={fieldClass} value={finForm.labor_wage_rate || ''} onChange={e => handleFinanceFieldChange('labor_wage_rate', e.target.value)} placeholder="e.g. 1000" />
          </div>
        </div>
      )}

      {tab === 'fertilizer' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>No. of Bags *</label>
            <input required type="number" step="any" className={fieldClass} value={finForm.fertilizer_bags || ''} onChange={e => handleFinanceFieldChange('fertilizer_bags', e.target.value)} placeholder="e.g. 10" />
          </div>
          <div>
            <label className={labelClass}>Price per Bag (Rs) *</label>
            <input required type="number" step="any" className={fieldClass} value={finForm.fertilizer_price_per_bag || ''} onChange={e => handleFinanceFieldChange('fertilizer_price_per_bag', e.target.value)} placeholder="e.g. 4500" />
          </div>
        </div>
      )}

      {tab !== 'irrigation' && tab !== 'spray' && (
        <>
          <div>
            <label className={labelClass}>Transaction Date *</label>
            <input required type="date" className={fieldClass} value={finForm.date || ''} onChange={e => setFinForm({ ...finForm, date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Associate with Crop Sector')}</label>
            <select className={fieldClass} value={finForm.crop_id} onChange={e => setFinForm({ ...finForm, crop_id: e.target.value })}>
              <option value="farm-wide">{L('General / Farm-Wide Operational')}</option>
              {crops.map(c => (
                <option key={c._id} value={c._id}>Crop: {c.name} ({c.status})</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label className={labelClass}>{tab === 'spray' ? 'Notes' : 'Ledger Notes'}</label>
        <textarea rows="2" className={fieldClass} value={finForm.notes} onChange={e => setFinForm({ ...finForm, notes: e.target.value })} placeholder={tab === 'irrigation' ? 'Optional' : 'Purchase verified, receipt attached...'} />
      </div>

      {tab !== 'irrigation' && tab !== 'spray' && (
        <div>
          <label className={labelClass}>{L('Receipt Photo (Optional)')}</label>
          <ImageUploader
            label={L('Add receipt photo')}
            maxDim={900}
            quality={0.72}
            value={finForm.receipt_base64 || ''}
            onDone={(b64) => setFinForm({ ...finForm, receipt_base64: b64 })}
            onRemove={() => setFinForm({ ...finForm, receipt_base64: '' })}
            variant="compact"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider cursor-pointer">{L('Cancel')}</button>
        <button type="submit" className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer">
          {tab === 'irrigation' ? <Droplets size={14} /> : tab === 'spray' ? <FlaskConical size={14} /> : <CheckCircle size={14} />} {submitLabel()}
        </button>
      </div>
    </form>
  );
}
