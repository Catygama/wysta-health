const puppeteer = require('puppeteer');
const path = require('path');

async function captureDiagram() {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setViewport({
		width: 1200,
		height: 800,
		deviceScaleFactor: 2
	});

	const filePath = path.join(__dirname, 'diagrama-navegacao.html');
	await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

	// Wait for Mermaid to render
	await page.waitForSelector('.mermaid svg', { timeout: 10000 });
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Full page screenshot
	await page.screenshot({
		path: path.join(__dirname, 'images', 'diagrama-navegacao-completo.png'),
		fullPage: true
	});
	console.log('✓ Saved: images/diagrama-navegacao-completo.png');

	// Individual diagrams
	const diagrams = await page.$$('.mermaid');
	const titles = ['visao-geral', 'fluxo-utente', 'fluxo-profissional', 'fluxo-admin', 'fluxo-chat'];

	for (let i = 0; i < diagrams.length && i < titles.length; i++) {
		const box = await diagrams[i].boundingBox();
		if (box) {
			await page.screenshot({
				path: path.join(__dirname, 'images', `diagrama-${titles[i]}.png`),
				clip: {
					x: Math.max(0, box.x - 20),
					y: Math.max(0, box.y - 40),
					width: box.width + 40,
					height: box.height + 60
				}
			});
			console.log(`✓ Saved: images/diagrama-${titles[i]}.png`);
		}
	}

	await browser.close();
	console.log('\n✓ All diagrams saved!');
}

captureDiagram().catch(console.error);
