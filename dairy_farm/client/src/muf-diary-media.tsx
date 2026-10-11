import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import DetailModal from './muf-modal';
import { notify, useConfirm } from './muf-confirm';
import { L } from './i18n';
export interface DiaryPhoto { id: string; date: string; data: string; bytes: number; createdAt: string; }
interface Props { date: string; photos: DiaryPhoto[]; onChange: (photos: DiaryPhoto[]) => void | Promise<void>; canEdit?: boolean; uploadPhoto?: (file: File) => Promise<string>; }
const MAX_PHOTOS = 10, MAX_BYTES = 160 * 1024;
const bytesOf = (s: string) => Math.round((s.length - s.indexOf(',') - 1) * 0.75);
function loadImage(file: File): Promise<HTMLImageElement> { return new Promise((resolve,reject)=>{ const url=URL.createObjectURL(file),img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('The selected file is not a valid image.'))};img.src=url; }); }
async function compress(file: File): Promise<{data:string;bytes:number}> {
 const img=await loadImage(file); let data='';
 for(const [side,q] of [[1280,.72],[1100,.62],[960,.55],[800,.48],[640,.42],[480,.36]] as const){
  const scale=Math.min(1,side/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image compression is not supported in this browser.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',q);if(bytesOf(data)<=MAX_BYTES)break;
 }
 if(bytesOf(data)>MAX_BYTES)throw new Error('This photo is too large even after compression. Try a smaller image.');
 return {data,bytes:bytesOf(data)};
}
const makeId=()=>`diary-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
export default function MufDiaryMedia({date,photos,onChange,canEdit=true,uploadPhoto}:Props){
 const confirm=useConfirm(),[busy,setBusy]=useState(false),[viewing,setViewing]=useState<DiaryPhoto|null>(null),picker=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),[current,setCurrent]=useState(photos);
 useEffect(()=>setCurrent(photos),[photos]);
 async function addFiles(files:FileList|null){if(!files?.length)return;setBusy(true);try{const next=[...current];for(const file of Array.from(files)){if(next.length>=MAX_PHOTOS){notify(L('Only {n} photos can be saved for one day.',{n:MAX_PHOTOS}),'info');break;}if(!file.type.startsWith('image/'))continue;const out=uploadPhoto ? {data:await uploadPhoto(file),bytes:file.size} : await compress(file);next.push({id:makeId(),date,data:out.data,bytes:out.bytes,createdAt:new Date().toISOString()});}await onChange(next);setCurrent(next);notify(L('Photos added to the diary.'),'success');}catch(e){notify(e instanceof Error?e.message:L('Could not save the photo.'),'error');}finally{setBusy(false);if(picker.current)picker.current.value='';if(camera.current)camera.current.value='';}}
 async function remove(photo:DiaryPhoto){const ok=await confirm({title:L('Delete photo'),message:L('This cannot be undone.'),confirmLabel:L('Delete'),cancelLabel:L('Cancel'),tone:'danger'});if(!ok)return;const next=current.filter(p=>p.id!==photo.id);try{await onChange(next);setCurrent(next);setViewing(null)}catch(e){notify(e instanceof Error?e.message:L('Could not delete the photo.'),'error')}}
 return <section className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3" aria-label={L('Diary photos')}>
  <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{L('Photos')} <span className="text-xs text-slate-400">{current.length}/{MAX_PHOTOS}</span></h4>
  {canEdit&&<div className="flex flex-wrap gap-2"><button type="button" disabled={busy||current.length>=MAX_PHOTOS} onClick={()=>camera.current?.click()} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-50"><Camera size={14}/>{L('Take photo')}</button><button type="button" disabled={busy||current.length>=MAX_PHOTOS} onClick={()=>picker.current?.click()} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-50"><ImagePlus size={14}/>{L('Add photo')}</button></div>}</div>
  <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>void addFiles(e.target.files)}/><input ref={picker} type="file" accept="image/*" multiple hidden onChange={e=>void addFiles(e.target.files)}/>
  {current.length===0?<p className="text-xs text-slate-400">{L('No photos for this day yet.')}</p>:<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{current.map(p=><button type="button" key={p.id} className="aspect-square overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-800" onClick={()=>setViewing(p)} aria-label={L('Open photo')}><img src={p.data} alt={L('Diary photo')} className="h-full w-full object-cover" loading="lazy"/></button>)}</div>}
  <p className="text-[11px] text-slate-400">{L('Photos are compressed and saved to the farm database, so they can be viewed on other devices.')}</p>
  <DetailModal open={!!viewing} onClose={()=>setViewing(null)} title={L('Diary photo')} subtitle={date} size="small">{viewing&&<div className="space-y-3"><img src={viewing.data} alt={L('Diary photo')} className="max-h-[60vh] w-full rounded-lg object-contain"/>{canEdit&&<button type="button" onClick={()=>void remove(viewing)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white"><Trash2 size={14}/>{L('Delete photo')}</button>}</div>}</DetailModal>
 </section>;
}
