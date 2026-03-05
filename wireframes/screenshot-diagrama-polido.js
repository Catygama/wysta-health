const puppeteer = require('puppeteer');
const path = require('path');

async function captureDiagram() {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setViewport({
		width: 900,
		height: 1200,
		deviceScaleFactor: 2
	});

	const filePath = path.join(__dirname, 'diagrama-polido.html');
	await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

	const sections = [
		{ name: 'diagrama-1-visao-geral', sectionIndex: 0 },
		{ name: 'diagrama-2-utente', sectionIndex: 1 },
		{ name: 'diagrama-3-chat-triagem', sectionIndex: 2 },
		{ name: 'diagrama-4-profissional', sectionIndex: 3 },
		{ name: 'diagrama-5-admin', sectionIndex: 4 }
	];

	for (const section of sections) {
		const bounds = await page.evaluate((idx) => {
			const headers = document.querySelectorAll('.section-header');
			const flowSections = document.querySelectorAll('.flow-section');
			
			if (!headers[idx] || !flowSections[idx]) return null;
			
			const headerRect = headers[idx].getBoundingClientRect();
			const flowRect = flowSections[idx].getBoundingClientRect();
			
			// Check if there's a note inside
			const note = flowSections[idx].querySelector('.note');
			const noteBottom = note ? note.getBoundingClientRect().bottom : flowRect.bottom;
			
			return {
				x: 30,
				y: headerRect.top - 15,
				width: 840,
				height: Math.max(flowRect.bottom, noteBottom) - headerRect.top + 30
			};
		}, section.sectionIndex);

		if (bounds) {
			await page.screenshot({
				path: path.join(__dirname, 'images', `${section.name}.png`),
				clip: bounds
			});
			console.log(`✓ ${section.name}.png`);
		}
	}

	await browser.close();
	console.log('\n✓ 5 diagramas guardados!');
}

captureDiagram().catch(console.error);
