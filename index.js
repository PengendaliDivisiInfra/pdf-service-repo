const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/generate-pdf', async (req, res) => {
  const { html, scale, format = 'A3', isLandscape = true } = req.body;
  let browser = null;

  console.log(`[Railway] Menerima request. Ukuran HTML: ${(html.length / 1024 / 1024).toFixed(2)} MB`);

  try {
    browser = await puppeteer.launch({
      headless: "new",
      // Kurangi timeout agar tidak menggantung terlalu lama
      protocolTimeout: 50000, 
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Sangat penting untuk mencegah OOM di Docker
        '--disable-gpu',
        '--font-render-hinting=none',
        '--js-flags="--max-old-space-size=256"' // Batasi memori JS
      ]
    });

    const page = await browser.newPage();
    
    // Matikan pemuatan gambar untuk menghemat memori (jika logo tidak terlalu penting)
    // await page.setRequestInterception(true);
    // page.on('request', (request) => {
    //   if (request.resourceType() === 'image') request.abort();
    //   else request.continue();
    // });

    await page.setContent(html, { 
      waitUntil: 'domcontentloaded', 
      timeout: 45000 
    });
    
    await page.evaluateHandle('document.fonts.ready');
    // Buffer 1 detik untuk layout
    await new Promise(r => setTimeout(r, 1000));

    const pdfBuffer = await page.pdf({
      format: format,
      landscape: isLandscape,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; font-family: 'Segoe UI', Arial, sans-serif; color: #64748b; text-align: right; padding-right: 10mm;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
      timeout: 45000
    });

    console.log(`[Railway] PDF Berhasil dibuat.`);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('=== RAILWAY PDF ERROR ===');
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});
