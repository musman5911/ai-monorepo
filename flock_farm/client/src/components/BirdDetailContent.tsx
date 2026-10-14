import React from 'react';
import { Calendar, Pencil, ShieldAlert, Syringe, Trash2 } from 'lucide-react';
import { Bird, Lang, VaccinationRecord } from '../types';
import { L } from '../i18n';
import BirdAvatar, { breedLabel } from './BirdAvatar';
import { calculateCurrentAge } from './flock/birdUtils';
import { mufStoryNet, mufVerdictText, mufDaysBetween } from '../muf-story';
interface BirdDetailContentProps{bird:Bird;detailVaccinations:VaccinationRecord[];vaccinationIntervalDays:number;lang?:Lang;canEdit?:boolean;canDelete?:boolean;onEdit:()=>void;onDelete?:()=>void}
export default function BirdDetailContent({bird,detailVaccinations,vaccinationIntervalDays,lang='en',canEdit=false,canDelete=false,onEdit,onDelete}:BirdDetailContentProps){
 const getVaccinationBadge=(lastVac:string|undefined)=>{if(!lastVac)return <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-3xs font-mono rounded-md">⚠ Unvaccinated</span>;const diffDays=Math.floor((new Date().getTime()-new Date(lastVac).getTime())/(1000*60*60*24));if(diffDays>vaccinationIntervalDays)return <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-3xs font-mono rounded-md">🔴 Overdue</span>;if(diffDays>=vaccinationIntervalDays-7)return <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-3xs font-mono rounded-md">🟡 Due Soon</span>;return <span className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 text-3xs font-mono rounded-md">✅ OK</span>};
 const getBirdCardTone=(item:Bird)=>item.status==='Dead'?'bg-rose-50/80 border-rose-200':item.status==='Sold'?'bg-violet-50/80 border-violet-200':item.status==='Sick'?'bg-red-50/80 border-red-200':item.gender==='Male'?'bg-sky-50/70 border-sky-200':'bg-rose-50/60 border-rose-200';
 const getBirdStatusTone=(status:Bird['status'])=>status==='Dead'?'bg-rose-100 text-rose-700 border-rose-200':status==='Sold'?'bg-violet-100 text-violet-700 border-violet-200':status==='Sick'?'bg-red-100 text-red-700 border-red-200':'bg-emerald-100 text-emerald-700 border-emerald-200';
 const getGenderTone=(gender:Bird['gender'])=>gender==='Male'?'bg-sky-100 text-sky-700 border-sky-200':'bg-pink-100 text-pink-700 border-pink-200';
 return (
            <div className="space-y-5">
              <div className={`rounded-3xl border p-4 sm:p-5 ${getBirdCardTone(bird)}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <BirdAvatar bird={bird} size="lg" shape="rounded" className="shrink-0" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{bird.name}</h3>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${getGenderTone(bird.gender)}`}>
                        {bird.gender === 'Male' ? '♂' : '♀'}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getBirdStatusTone(bird.status)}`}>
                        {bird.status}
                      </span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {breedLabel(bird)}
                      </span>
                      {bird.sourceIncubationId && (
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          Incubation #{bird.sourceIncubationId}
                        </span>
                      )}
                    </div>
  
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <DetailValueCard label={L('Age')} value={calculateCurrentAge(bird)} />
                      <DetailValueCard label="Price" value={`Rs ${bird.price.toLocaleString()}`} />
                      <DetailValueCard label={L('Bought')} value={bird.dateBought} />
                      <DetailValueCard label={L('Last Vaccine')} value={bird.lastVaccinationDate || '—'} />
                    </div>
                  </div>
                </div>
              </div>
  
              {/* ── Bird Story — facts only, no estimates (muf-story) ── */}
              {(() => {
                const b = bird;
                const sold = b.status === 'Sold';
                const myVax = detailVaccinations;
                const vaxCost = myVax.reduce((a, v) => a + (v.cost || 0), 0);
                const daysOnFarm = mufDaysBetween(b.dateBought, sold ? (b.saleDate || undefined) : b.status === 'Dead' ? (b.dateDied || undefined) : undefined);
                const { net, isProfit } = sold ? mufStoryNet(b.salePrice || 0, (b.price || 0) + vaxCost) : { net: 0, isProfit: false };
                return (
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">📖 {L('Bird Story')}</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Bought')}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">Rs {(b.price || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{b.dateBought || '—'}</p>
                      </div>
                      {sold && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Sold')}</p>
                          <p className="font-bold text-purple-600">Rs {(b.salePrice || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">{b.saleDate || '—'}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Days on farm')}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{daysOnFarm === null ? '—' : daysOnFarm}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Vaccines')}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{myVax.length}{vaxCost > 0 ? ` · Rs ${vaxCost.toLocaleString()}` : ''}</p>
                      </div>
                    </div>
                    {sold && (
                      <div className={`rounded-xl p-2.5 text-center text-xs font-bold border ${
                        isProfit
                          ? 'bg-farm-50 dark:bg-farm-900/20 border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-400'
                          : net === 0
                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                      }`}>
                        {isProfit ? '✅ ' : net === 0 ? '⚖️ ' : '⚠️ '}{mufVerdictText(net, lang || 'en', 'bird', true)}
                        <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{L('(egg income is counted flock-wide, not included here)')}</span>
                      </div>
                    )}
                  </section>
                );
              })()}
  
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Calendar className="h-4 w-4 text-slate-500" /> Overview
                  </h4>
                  <div className="space-y-2">
                    <DetailRow label="Bird ID" value={`BRD-${bird.id.toString().padStart(3, '0')}`} mono />
                    <DetailRow label={L('Gender')} value={bird.gender} />
                    <DetailRow label={L('Breed')} value={breedLabel(bird)} />
                    <DetailRow label={L('Date Bought')} value={bird.dateBought} mono />
                    <DetailRow label={L('Date of Birth')} value={bird.dateOfBirth || '—'} mono />
                    <DetailRow label="Purchase Price" value={`Rs ${bird.price.toLocaleString()}`} mono />
                    <DetailRow label={L('Vaccination Status')} valueNode={getVaccinationBadge(bird.lastVaccinationDate)} />
                  </div>
                </section>
  
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ShieldAlert className="h-4 w-4 text-slate-500" /> Status Details
                  </h4>
                  {bird.status === 'Sold' ? (
                    <div className="space-y-2">
                      <DetailRow label={L('Sale Date')} value={bird.saleDate || '—'} mono />
                      <DetailRow label="Sale Price" value={`Rs ${(bird.salePrice ?? 0).toLocaleString()}`} mono />
                      <DetailRow
                        label={L('Profit / Loss')}
                        value={`Rs ${((bird.salePrice ?? 0) - bird.price).toLocaleString()}`}
                        valueClassName={((bird.salePrice ?? 0) - bird.price) >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                        mono
                      />
                    </div>
                  ) : bird.status === 'Dead' ? (
                    <div className="space-y-2">
                      <DetailRow label={L('Date Died')} value={bird.dateDied || '—'} mono />
                      <DetailRow label={L('Reason')} value={bird.deathReason || '—'} />
                      <DetailRow label={L('Notes')} value={bird.deathDetail || '—'} />
                    </div>
                  ) : bird.status === 'Sick' ? (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3 text-[12px] text-orange-800">
                      This bird is marked sick and should continue to appear in health alerts until status is changed.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] text-emerald-800">
                      This bird is active in the flock registry and included in normal flock counts.
                    </div>
                  )}
                </section>
              </div>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Syringe className="h-4 w-4 text-slate-500" /> Vaccination History
                </h4>
                {detailVaccinations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500">
                    {L('No vaccination logs found for this bird yet.')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailVaccinations.map((record) => (
                      <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-[12px] text-slate-700">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{record.vaccineName}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{record.notes || 'No notes recorded'}</p>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">{record.date}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {record.dose && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Dose: {record.dose}</span>}
                          {typeof record.cost === 'number' && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Cost: Rs {record.cost.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
  
              {(canDelete || canEdit) && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={onDelete}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Bird
                    </button>
                  )}
                  {canEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-2 rounded-xl bg-farm-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-farm-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Bird
                  </button>
                  )}
                </div>
              )}
            </div>
 );
}
function DetailValueCard({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-1 truncate font-mono text-sm font-semibold text-slate-800">{value}</p></div>}
function DetailRow({label,value,valueNode,mono=false,valueClassName=''}:{label:string;value?:string;valueNode?:React.ReactNode;mono?:boolean;valueClassName?:string}){return <div className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-[12px]"><span className="font-semibold text-slate-500">{label}</span><span className={`max-w-[65%] text-right text-slate-800 ${mono?'font-mono':''} ${valueClassName}`}>{valueNode??value??'—'}</span></div>}
