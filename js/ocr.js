let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          document.dispatchEvent(new CustomEvent('ocr-progress', { detail: pct }));
        }
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
  }
  return worker;
}

/**
 * @param {string|HTMLImageElement|HTMLCanvasElement|Blob} image
 * @returns {Promise<string>}
 */
export async function recognizeText(image) {
  const w = await getWorker();
  const { data } = await w.recognize(image);
  return data.text || '';
}

export async function terminateOcr() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
