import React, { useEffect, useState } from 'react';
import { Camera, CalendarPlus, Trash2, Loader } from 'lucide-react';
import * as api from '../api';
import ImageUploader from './ImageUploader';

import { mufToday } from '../muf-date';

const todayIso = () => mufToday();

export default function CropOpsPanel({
  crop,
  userRole,
  compressAndConvertToBase64,
  refreshData,
  showAlert,
  onPlanNext
}) {
  const isAdmin = userRole === 'admin';
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadPhotos = async () => {
    if (!crop?._id) return;
    try {
      const photoRes = await api.getCropPhotos(crop._id);
      setPhotos(photoRes.data || []);
    } catch (err) {
      console.warn('Failed to load crop diary:', err);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [crop?._id]);

  const handleAddPhoto = async (base64) => {
    if (!base64 || !isAdmin) return;
    if (photos.length >= 3) return showAlert('This crop already has 3 diary photos.', true);
    setBusy(true);
    try {
      await api.addCropPhoto({
        crop_id: crop._id,
        image_base64: base64,
        uploaded_at: todayIso(),
        label: photos.length === 0 ? 'Sowing' : photos.length === 1 ? 'Mid-season' : 'Harvest'
      });
      showAlert('Photo added to the crop diary.');
      await loadPhotos();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to upload photo.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePhoto = async (id) => {
    setBusy(true);
    try {
      await api.deleteCropPhoto(id);
      showAlert('Diary photo removed.');
      await loadPhotos();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove photo.', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 space-y-3">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Camera size={12} /> Photo diary ({photos.length}/3)
        </h4>
        <p className="text-[11px] text-slate-500">Keep 2–3 field pictures. Each photo stores the date it was uploaded. Irrigation and spray live in Record Book Log.</p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo._id} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
              <img src={photo.image_base64} alt={photo.label || 'Crop diary'} className="w-full h-24 object-cover" />
              <div className="px-1.5 py-1 text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80">
                {photo.uploaded_at || '—'}{photo.label ? ` · ${photo.label}` : ''}
              </div>
              {isAdmin && (
                <button type="button" onClick={() => handleDeletePhoto(photo._id)} className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white" aria-label="Delete photo">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {isAdmin && photos.length < 3 && (
            <div className="h-24 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5">
              {busy ? (
                <Loader size={16} className="animate-spin text-slate-400" />
              ) : (
                <Camera size={16} className="text-slate-500" />
              )}
              <ImageUploader
                label="Add photo"
                maxDim={400}
                showPreview={false}
                onDone={handleAddPhoto}
                className="text-[10px]"
              />
            </div>
          )}
        </div>
      </div>

      {crop.status === 'Completed' && isAdmin && (
        <button
          type="button"
          onClick={() => onPlanNext(crop)}
          className="w-full px-4 py-2.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"
        >
          <CalendarPlus size={15} /> Plan next season
        </button>
      )}
    </div>
  );
}
