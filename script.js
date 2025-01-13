const canvas = new fabric.Canvas('canvas', {
	width: 800,
	height: 800,
});

const upload = document.getElementById('upload');
const categoryInput = document.getElementById('category');
const colorInput = document.getElementById('color');
const addCategory = document.getElementById('add-category');
const categorySelect = document.getElementById('category-select');
const deleteCategory = document.getElementById('delete-category');
const exportBtn = document.getElementById('export');

let categories = {};
let imageWidth = 0;
let imageHeight = 0;
let startX, startY;
let rect;
let isDrawing = false;
let isModifying = false;

upload.addEventListener('change', (e) => {
	const file = e.target.files[0];
	if (!file) return;

	const validFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
	if (!validFormats.includes(file.type)) {
		alert('Formato no válido. Use PNG, JPG, JPEG o WEBP.');
		return;
	}

	const reader = new FileReader();
	reader.onload = function (event) {
		fabric.Image.fromURL(event.target.result, (img) => {
			imageWidth = img.width;
			imageHeight = img.height;

			const scaleFactor = Math.min(canvas.width / img.width, canvas.height / img.height);

			img.set({
				scaleX: scaleFactor,
				scaleY: scaleFactor,
				left: (canvas.width - img.width * scaleFactor) / 2,
				top: (canvas.height - img.height * scaleFactor) / 2,
				selectable: false,
			});

			canvas.clear();
			canvas.add(img);
			canvas.renderAll();
		});
	};
	reader.readAsDataURL(file);
});

addCategory.addEventListener('click', () => {
	const name = categoryInput.value.trim();
	const color = colorInput.value;

	if (name && !categories[name]) {
		categories[name] = color;
		const option = document.createElement('option');
		option.value = name;
		option.textContent = name;
		categorySelect.appendChild(option);
		categoryInput.value = '';
	} else {
		alert('Ingrese un nombre único para la categoría.');
	}
});

canvas.on('object:scaling', () => {
	isModifying = true;
});

canvas.on('object:moving', () => {
	isModifying = true;
});

canvas.on('mouse:down', (event) => {
	if (isModifying || canvas.getActiveObject()) {
		return;
	}

	const category = categorySelect.value;
	if (!category) {
		alert('Seleccione una categoría antes de etiquetar.');
		return;
	}

	isDrawing = true;
	const pointer = canvas.getPointer(event.e);
	startX = pointer.x;
	startY = pointer.y;

	rect = new fabric.Rect({
		left: startX,
		top: startY,
		width: 0,
		height: 0,
		fill: categories[category],
		opacity: 0.5,
		category: category,
	});

	canvas.add(rect);
});

canvas.on('mouse:move', (event) => {
	if (!isDrawing) return;

	const pointer = canvas.getPointer(event.e);
	const width = pointer.x - startX;
	const height = pointer.y - startY;

	rect.set({
		width: Math.abs(width),
		height: Math.abs(height),
		left: width > 0 ? startX : pointer.x,
		top: height > 0 ? startY : pointer.y,
	});

	canvas.renderAll();
});

canvas.on('mouse:up', () => {
	isDrawing = false;
	isModifying = false;
});

deleteCategory.addEventListener('click', () => {
	const selectedCategory = categorySelect.value;
	if (selectedCategory) {
		const objects = canvas.getObjects('rect');
		objects.forEach((obj) => {
			if (obj.category === selectedCategory) {
				canvas.remove(obj);
			}
		});

		delete categories[selectedCategory];
		categorySelect.remove(categorySelect.selectedIndex);
		canvas.renderAll();
	}
});

exportBtn.addEventListener('click', () => {
	if (!imageWidth || !imageHeight) {
		alert('Cargue una imagen primero.');
		return;
	}

	const annotations = [];
	const objects = canvas.getObjects('rect');
	const categories_array = Object.keys(categories);

	// Crear archivo de clases
	const classesContent = categories_array.join('\n');
	const classesBlob = new Blob([classesContent], { type: 'text/plain' });
	const classesLink = document.createElement('a');
	classesLink.href = URL.createObjectURL(classesBlob);
	classesLink.download = 'classes.txt';
	classesLink.click();

	// Obtener imagen y factores de escala
	const img = canvas.getObjects()[0];
	const imgLeft = img.left;
	const imgTop = img.top;
	const scaleFactor = img.scaleX;

	objects.forEach((obj) => {
		if (obj.type === 'rect') {
			// Convertir a coordenadas relativas
			const relativeX = (obj.left - imgLeft) / (img.width * scaleFactor);
			const relativeY = (obj.top - imgTop) / (img.height * scaleFactor);
			const relativeWidth = (obj.width * obj.scaleX) / (img.width * scaleFactor);
			const relativeHeight = (obj.height * obj.scaleY) / (img.height * scaleFactor);

			// Calcular centro
			const x_center = relativeX + relativeWidth / 2;
			const y_center = relativeY + relativeHeight / 2;

			const category_index = categories_array.indexOf(obj.category);

			// Normalizar valores
			const normalizedX = Math.max(0, Math.min(1, x_center));
			const normalizedY = Math.max(0, Math.min(1, y_center));
			const normalizedWidth = Math.max(0, Math.min(1, relativeWidth));
			const normalizedHeight = Math.max(0, Math.min(1, relativeHeight));

			annotations.push(`${category_index} ${normalizedX.toFixed(6)} ${normalizedY.toFixed(6)} ${normalizedWidth.toFixed(6)} ${normalizedHeight.toFixed(6)}`);
		}
	});

	const labelsBlob = new Blob([annotations.join('\n')], { type: 'text/plain' });
	const labelsLink = document.createElement('a');
	labelsLink.href = URL.createObjectURL(labelsBlob);
	labelsLink.download = 'labels.txt';
	labelsLink.click();
});
