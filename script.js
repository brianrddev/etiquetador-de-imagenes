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
let deleteButton = null; // Botón flotante para borrar cuadros

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

// Crear y manejar el botón de eliminación
canvas.on('selection:created', (event) => {
	if (deleteButton) {
		deleteButton.remove();
		deleteButton = null;
	}

	const activeObject = canvas.getActiveObject();
	if (activeObject) {
		const rectCoords = activeObject.getBoundingRect();
		createDeleteButton(rectCoords, activeObject);
	}
});

// Remover el botón al deseleccionar
canvas.on('selection:cleared', () => {
	if (deleteButton) {
		deleteButton.remove();
		deleteButton = null;
	}
});

// Manejar la eliminación con la tecla "Supr"
document.addEventListener('keydown', (event) => {
	if (event.key === 'Delete' || event.key === 'Backspace') {
		const activeObject = canvas.getActiveObject();
		if (activeObject) {
			canvas.remove(activeObject); // Eliminar el objeto seleccionado
			canvas.discardActiveObject(); // Deseleccionar cualquier objeto
			canvas.renderAll(); // Renderizar el lienzo nuevamente
		}
	}
});

deleteCategory.addEventListener('click', () => {
	// Obtener la categoría seleccionada
	const selectedCategory = categorySelect.value;

	// Verificar si hay una categoría seleccionada
	if (selectedCategory) {
		// Eliminar todos los rectángulos asociados a la categoría en el canvas
		const objects = canvas.getObjects('rect');
		objects.forEach((obj) => {
			if (obj.category === selectedCategory) {
				canvas.remove(obj); // Eliminar el rectángulo
			}
		});

		// Eliminar la categoría del objeto `categories`
		delete categories[selectedCategory];

		// Eliminar la categoría del `select`
		const optionToRemove = Array.from(categorySelect.options).find((option) => option.value === selectedCategory);
		if (optionToRemove) {
			categorySelect.removeChild(optionToRemove);
		}

		// Renderizar nuevamente el lienzo
		canvas.renderAll();
	} else {
		alert('Por favor, selecciona una categoría para eliminar.');
	}
});

canvas.on('selection:created', (event) => {
	if (deleteButton) {
		deleteButton.remove();
		deleteButton = null;
	}

	const activeObject = canvas.getActiveObject();
	if (activeObject) {
		const rectCoords = activeObject.getBoundingRect();
		createDeleteButton(rectCoords, activeObject);
	}
});

canvas.on('selection:cleared', () => {
	if (deleteButton) {
		deleteButton.remove();
		deleteButton = null;
	}
});

// Exportar etiquetas
exportBtn.addEventListener('click', () => {
	if (!imageWidth || !imageHeight) {
		alert('Cargue una imagen primero.');
		return;
	}

	const format = document.getElementById('format-select').value;
	const annotations = [];
	const objects = canvas.getObjects('rect');
	const categoriesArray = Object.keys(categories);

	if (format === 'yolo') {
		objects.forEach((obj) => {
			if (obj.type === 'rect') {
				const relativeX = (obj.left - canvas.getObjects()[0].left) / imageWidth;
				const relativeY = (obj.top - canvas.getObjects()[0].top) / imageHeight;
				const relativeWidth = obj.width / imageWidth;
				const relativeHeight = obj.height / imageHeight;
				const categoryIndex = categoriesArray.indexOf(obj.category);

				annotations.push(`${categoryIndex} ${relativeX.toFixed(6)} ${relativeY.toFixed(6)} ${relativeWidth.toFixed(6)} ${relativeHeight.toFixed(6)}`);
			}
		});
	}

	if (format === 'coco') {
		const cocoAnnotations = objects.map((obj, index) => ({
			id: index + 1,
			category_id: categoriesArray.indexOf(obj.category),
			bbox: [obj.left, obj.top, obj.width * obj.scaleX, obj.height * obj.scaleY],
		}));
		annotations.push(JSON.stringify({ annotations: cocoAnnotations, categories: categoriesArray }));
	}

	if (format === 'pascal') {
		annotations.push(
			objects
				.map(
					(obj) => `
					<object>
						<name>${obj.category}</name>
						<bndbox>
							<xmin>${obj.left}</xmin>
							<ymin>${obj.top}</ymin>
							<xmax>${obj.left + obj.width}</xmax>
							<ymax>${obj.top + obj.height}</ymax>
						</bndbox>
					</object>
				`
				)
				.join('\n')
		);
	}

	// Descargar archivo
	const blob = new Blob([annotations.join('\n')], { type: 'text/plain' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `annotations.${format === 'coco' ? 'json' : 'txt'}`;
	link.click();
});
