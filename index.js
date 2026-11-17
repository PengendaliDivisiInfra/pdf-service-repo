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

  try {
    browser = await puppeteer.launch({
      headless: "new",
      protocolTimeout: 180000, // Beri waktu 3 menit untuk protokol internal
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });

    const page = await browser.newPage();
    
    // 1. Tunggu sampai semua aset (CSS, Font, Gambar) benar-benar termuat
    await page.setContent(html, { 
      waitUntil: ['networkidle0', 'domcontentloaded'], 
      timeout: 120000 
    });
    
    // 2. Pastikan font sudah siap
    await page.evaluateHandle('document.fonts.ready');
    
    // 3. Buffer ekstra untuk layouting tabel raksasa
    await new Promise(r => setTimeout(r, 2000));

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
      timeout: 120000
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('=== PDF ERROR ===');
    console.error(error); // Log detail error ke Railway
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});
