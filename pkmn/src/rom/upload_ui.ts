// ROM upload screen — shown before the game when no cached data exists
// Game Boy aesthetic: black background, white text, simple file picker

import { validateRom, extractRom, installRomData } from './index';
import { ROM_SHA1 } from './rom_offsets';
import { hasCachedData, loadCachedRomData, cacheRomData } from './rom_cache';

/** Try loading from IndexedDB cache. Returns true if cache hit. */
export async function tryLoadFromCache(): Promise<boolean> {
  try {
    if (!await hasCachedData(ROM_SHA1)) return false;
    const data = await loadCachedRomData(ROM_SHA1);
    if (!data) return false;
    installRomData(data);
    return true;
  } catch {
    return false;
  }
}

/** Show the ROM upload screen and wait for a valid ROM.
 *  Returns when ROM is extracted and data providers are installed. */
export function showUploadScreen(): Promise<void> {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'rom-upload';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: #000; color: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: monospace; font-size: 14px; line-height: 1.6;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; max-width: 480px; padding: 20px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; letter-spacing: 1px;">
          Retro ROM Player
        </h2>
        <p style="margin: 0 0 24px; color: #aaa; font-size: 12px;">
          A retro ROM player
        </p>

        <div id="rom-dropzone" style="
          border: 2px dashed #555; border-radius: 8px; padding: 32px 24px;
          cursor: pointer; transition: border-color 0.2s;
        ">
          <p style="margin: 0 0 12px;">Drop <b>ROM</b> file here</p>
          <p style="margin: 0; color: #888; font-size: 12px;">or click to browse</p>
          <input type="file" id="rom-file-input" accept=".gbc,.gb"
            style="display: none;" />
        </div>

        <p style="margin: 16px 0 0; font-size: 11px; color: #555;">
          Supported: 1 MB ROM file
        </p>

        <p id="rom-status" style="margin: 16px 0 0; min-height: 20px; font-size: 12px; color: #888;"></p>
        <div id="rom-progress" style="display: none; margin-top: 12px;">
          <div style="background: #333; border-radius: 4px; height: 6px; overflow: hidden;">
            <div id="rom-progress-bar" style="
              background: #4c8; height: 100%; width: 0%;
              transition: width 0.3s ease;
            "></div>
          </div>
          <p id="rom-progress-text" style="margin: 8px 0 0; font-size: 11px; color: #888;"></p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dropzone = document.getElementById('rom-dropzone')!;
    const fileInput = document.getElementById('rom-file-input') as HTMLInputElement;
    const status = document.getElementById('rom-status')!;
    const progressDiv = document.getElementById('rom-progress')!;
    const progressBar = document.getElementById('rom-progress-bar')!;
    const progressText = document.getElementById('rom-progress-text')!;

    // Click to open file picker
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#4c8';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#555';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#555';
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    });

    // File input change
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
    });

    async function handleFile(file: File) {
      status.style.color = '#888';
      status.textContent = 'Reading file...';

      try {
        const buffer = await file.arrayBuffer();

        // Validate ROM
        status.textContent = 'Validating ROM...';
        const error = await validateRom(buffer);
        if (error) {
          status.style.color = '#f66';
          status.textContent = error;
          return;
        }

        // Extract data
        status.textContent = 'Extracting game data...';
        dropzone.style.display = 'none';
        progressDiv.style.display = 'block';

        const data = await extractRom(buffer, (progress) => {
          const pct = Math.round((progress.current / progress.total) * 100);
          progressBar.style.width = `${pct}%`;
          progressText.textContent = progress.step;
        });

        progressBar.style.width = '100%';
        progressText.textContent = 'Installing data...';

        // Install ROM data providers
        installRomData(data);

        // Store in IndexedDB for next visit
        try {
          await cacheRomData(ROM_SHA1, data);
        } catch {
          // Caching failure is non-fatal
        }

        // Remove overlay and resolve
        status.style.color = '#4c8';
        status.textContent = 'Ready!';
        await new Promise(r => setTimeout(r, 300)); // Brief flash of "Ready!"
        overlay.remove();
        resolve();
      } catch (err) {
        status.style.color = '#f66';
        status.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  });
}
