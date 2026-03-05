const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function convertWireframesToImages() {
	const wireframesDir = __dirname;
	const outputDir = path.join(wireframesDir, 'images');

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir);
	}

	const htmlFiles = fs.readdirSync(wireframesDir)
		.filter(file => file.endsWith('.html') && file !== 'index.html');

	console.log(`Found ${htmlFiles.length} wireframes to convert...\n`);

	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setViewport({
		width: 440,
		height: 900,
		deviceScaleFactor: 2
	});

	for (const file of htmlFiles) {
		const filePath = path.join(wireframesDir, file);
		const imageName = file.replace('.html', '.png');
		const imagePath = path.join(outputDir, imageName);

		console.log(`Converting: ${file}`);

		await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

		const bodyHandle = await page.$('body');
		const boundingBox = await bodyHandle.boundingBox();

		await page.screenshot({
			path: imagePath,
			clip: {
				x: 0,
				y: 0,
				width: Math.min(boundingBox.width + 40, 440),
				height: boundingBox.height + 40
			}
		});

		await bodyHandle.dispose();
		console.log(`  → Saved: images/${imageName}`);
	}

	await browser.close();

	console.log(`\n✓ Done! ${htmlFiles.length} images saved to: ${outputDir}`);
}

convertWireframesToImages().catch(console.error);
