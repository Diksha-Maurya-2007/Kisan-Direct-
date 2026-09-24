import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '').trim();
export const SUPABASE_BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET || 'Kisan-Direct-bucket').trim();

function initSupabase() {
  if (!rawUrl || !rawKey) return null;
  if (rawUrl.includes('placeholder') || rawUrl.includes('your-project')) return null;

  try {
    let url = rawUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    new URL(url);
    return createClient(url, rawKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.warn('Supabase initialization failed, running in offline fallback mode:', err);
    return null;
  }
}

// Supabase client instance (initialized safely)
export const supabase = initSupabase();

export const isSupabaseConfigured = Boolean(supabase);

// Demo mode OTP
export const DEMO_OTP = '1234';

/**
 * Convert a base64 Data URL to a Blob
 */
export function dataURLtoBlob(dataUrl) {
  try {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Failed to convert dataURL to Blob:', e);
    return new Blob([], { type: 'image/jpeg' });
  }
}

/**
 * Upload an image (File, Blob, or base64 data URL) to Supabase Storage.
 *
 * @param {File | Blob | string} imageInput - File, Blob, or base64 Data URL
 * @param {string} [bucket] - Target Supabase bucket name
 * @param {string} [folder='crops'] - Folder prefix inside bucket
 * @returns {Promise<{ url: string, path: string | null, isRemote: boolean, error: any }>}
 */
export async function uploadCropImage(imageInput, bucket = SUPABASE_BUCKET, folder = 'crops') {
  if (!imageInput) {
    return { url: '', path: null, isRemote: false, error: new Error('No image provided') };
  }

  // If Supabase is not configured, fallback gracefully to base64 Data URL
  if (!isSupabaseConfigured || !supabase) {
    const fallbackUrl = typeof imageInput === 'string'
      ? imageInput
      : await fileToDataUrl(imageInput);
    return {
      url: fallbackUrl,
      path: null,
      isRemote: false,
      error: null,
    };
  }

  try {
    let blob;
    let fileExt = 'jpg';

    if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:')) {
        blob = dataURLtoBlob(imageInput);
        const match = imageInput.match(/data:image\/([a-zA-Z0-9+]+);/);
        if (match && match[1]) fileExt = match[1] === 'jpeg' ? 'jpg' : match[1];
      } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        // Already a remote URL
        return { url: imageInput, path: null, isRemote: true, error: null };
      } else {
        blob = new Blob([imageInput], { type: 'image/jpeg' });
      }
    } else if (imageInput instanceof File || imageInput instanceof Blob) {
      blob = imageInput;
      if (imageInput.name) {
        const parts = imageInput.name.split('.');
        if (parts.length > 1) fileExt = parts.pop().toLowerCase();
      }
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = `${folder}/${uniqueId}.${fileExt}`;
    const contentType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Supabase upload to bucket "${bucket}" failed:`, uploadError.message || uploadError);
      const fallbackUrl = typeof imageInput === 'string'
        ? imageInput
        : await fileToDataUrl(imageInput);
      return { url: fallbackUrl, path: null, isRemote: false, error: uploadError };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: urlData?.publicUrl || '',
      path: data?.path || filePath,
      isRemote: true,
      error: null,
    };
  } catch (err) {
    console.error('Error during image upload:', err);
    const fallbackUrl = typeof imageInput === 'string'
      ? imageInput
      : await fileToDataUrl(imageInput);
    return { url: fallbackUrl, path: null, isRemote: false, error: err };
  }
}

/**
 * Save / Upsert a crop listing to Supabase Database (Table: `listings`)
 */
export async function saveListingToSupabase(listing) {
  if (!isSupabaseConfigured || !supabase || !listing) return { data: null, error: null };

  try {
    const row = {
      id: String(listing.id),
      crop_name: listing.cropName || listing.crop_name || '',
      quantity: Number(listing.quantity || 0),
      price: Number(listing.price || 0),
      grade: listing.grade || 'Grade A',
      location: listing.location || '',
      status: listing.status || 'Active',
      availability: listing.availability || 'Available now',
      harvest_date: listing.harvestDate || listing.harvest_date || null,
      available_from: listing.availableFrom || listing.available_from || null,
      image: listing.image || '',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('listings')
      .upsert(row, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('Supabase database save failed (table might not exist yet):', error.message || error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('Error saving listing to Supabase table:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all listings from Supabase Database (Table: `listings`)
 */
export async function fetchListingsFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return { data: null, error: null };

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch listings error:', error.message || error);
      return { data: null, error };
    }

    // Map database snake_case to frontend camelCase
    const formatted = (data || []).map((row) => ({
      id: row.id,
      cropName: row.crop_name || row.cropName || 'Crop',
      quantity: Number(row.quantity || 0),
      price: Number(row.price || 0),
      grade: row.grade || 'Grade A',
      location: row.location || '',
      status: row.status || 'Active',
      availability: row.availability || 'Available now',
      harvestDate: row.harvest_date || row.harvestDate || '',
      availableFrom: row.available_from || row.availableFrom || '',
      image: row.image || '',
    }));

    return { data: formatted, error: null };
  } catch (err) {
    console.error('Error fetching listings from Supabase:', err);
    return { data: null, error: err };
  }
}

/**
 * Delete a listing from Supabase Database
 */
export async function deleteListingFromSupabase(id) {
  if (!isSupabaseConfigured || !supabase || !id) return { error: null };

  try {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', String(id));

    if (error) {
      console.warn('Supabase delete listing error:', error.message || error);
    }
    return { error };
  } catch (err) {
    console.error('Error deleting listing from Supabase:', err);
    return { error: err };
  }
}

/**
 * Helper to convert File/Blob to base64 Data URL
 */
function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(fileOrBlob);
  });
}
