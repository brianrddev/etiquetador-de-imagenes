const canvas = new fabric.Canvas('canvas', {
	width: window.innerWidth * 0.7, // Más responsive
	height: window.innerHeight * 0.7,
	selection: false, // Previene selección múltiple no deseada
});

// Ajustar canvas al redimensionar ventana
window.addEventListener('resize', () => {
	canvas.setDimensions({
		width: window.innerWidth * 0.7,
		height: window.innerHeight * 0.7,
	});
	canvas.renderAll();
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
let currentImage = null;

// Mejorar manejo de carga de imágenes
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
			// Guardar referencia a la imagen actual
			currentImage = img;
			imageWidth = img.width;
			imageHeight = img.height;

			// Calcular escala manteniendo proporciones
			const scaleFactor = Math.min(canvas.width / img.width, canvas.height / img.height);

			img.set({
				scaleX: scaleFactor,
				scaleY: scaleFactor,
				left: (canvas.width - img.width * scaleFactor) / 2,
				top: (canvas.height - img.height * scaleFactor) / 2,
				selectable: false,
				evented: false, // Previene interacción con la imagen
			});

			canvas.clear();
			canvas.add(img);
			canvas.renderAll();

			// Mover imagen al fondo
			img.sendToBack();
		});
	};
	reader.readAsDataURL(file);
});

// Mejorar manejo de categorías
addCategory.addEventListener('click', () => {
	const name = categoryInput.value.trim();
	const color = colorInput.value;

	if (!name) {
		alert('Ingrese un nombre para la categoría.');
		return;
	}

	if (categories[name]) {
		alert('Esta categoría ya existe.');
		return;
	}

	categories[name] = color;
	const option = document.createElement('option');
	option.value = name;
	option.textContent = name;
	categorySelect.appendChild(option);
	categoryInput.value = '';
});

// Mejorar dibujo de rectángulos
canvas.on('mouse:down', (event) => {
	if (!currentImage) {
		alert('Cargue una imagen primero.');
		return;
	}

	const category = categorySelect.value;
	if (!category) {
		alert('Seleccione una categoría antes de etiquetar.');
		return;
	}

	if (isModifying || canvas.getActiveObject()) {
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
		stroke: categories[category],
		strokeWidth: 2,
		category: category,
		selectable: true,
		hasControls: true,
		hasBorders: true,
		lockRotation: true, // Prevenir rotación
	});

	canvas.add(rect);
	canvas.setActiveObject(rect);
});

canvas.on('mouse:move', (event) => {
	if (!isDrawing) return;

	const pointer = canvas.getPointer(event.e);
	let width = pointer.x - startX;
	let height = pointer.y - startY;

	// Restringir el rectángulo dentro de los límites de la imagen
	const imgBounds = currentImage.getBoundingRect();
	const newLeft = width > 0 ? startX : pointer.x;
	const newTop = height > 0 ? startY : pointer.y;

	width = Math.min(Math.abs(width), imgBounds.left + imgBounds.width - newLeft);
	height = Math.min(Math.abs(height), imgBounds.top + imgBounds.height - newTop);

	rect.set({
		width: width,
		height: height,
		left: newLeft,
		top: newTop,
	});

	canvas.renderAll();
});

canvas.on('mouse:up', () => {
	if (isDrawing) {
		// Verificar tamaño mínimo
		if (rect.width < 5 || rect.height < 5) {
			canvas.remove(rect);
		}
		isDrawing = false;
	}
	isModifying = false;
});

// Mejorar exportación
exportBtn.addEventListener('click', () => {
	if (!currentImage) {
		alert('Cargue una imagen primero.');
		return;
	}

	const format = document.getElementById('format-select').value;
	const objects = canvas.getObjects('rect');

	if (objects.length === 0) {
		alert('No hay etiquetas para exportar.');
		return;
	}

	const categoriesArray = Object.keys(categories);
	const imgBounds = currentImage.getBoundingRect();
	let annotations = [];

	switch (format) {
		case 'yolo':
			objects.forEach((obj) => {
				// Convertir coordenadas relativas a la imagen
				const relativeX = (obj.left - imgBounds.left) / imgBounds.width;
				const relativeY = (obj.top - imgBounds.top) / imgBounds.height;
				const relativeWidth = obj.width / imgBounds.width;
				const relativeHeight = obj.height / imgBounds.height;
				const categoryIndex = categoriesArray.indexOf(obj.category);

				if (relativeX >= 0 && relativeY >= 0 && relativeX <= 1 && relativeY <= 1) {
					annotations.push(`${categoryIndex} ${relativeX.toFixed(6)} ${relativeY.toFixed(6)} ${relativeWidth.toFixed(6)} ${relativeHeight.toFixed(6)}`);
				}
			});
			break;

		case 'coco':
			const cocoAnnotations = objects.map((obj, index) => ({
				id: index + 1,
				image_id: 1,
				category_id: categoriesArray.indexOf(obj.category) + 1,
				bbox: [obj.left - imgBounds.left, obj.top - imgBounds.top, obj.width, obj.height],
				area: obj.width * obj.height,
				segmentation: [],
				iscrowd: 0,
			}));

			annotations.push(
				JSON.stringify(
					{
						images: [
							{
								id: 1,
								width: imageWidth,
								height: imageHeight,
							},
						],
						annotations: cocoAnnotations,
						categories: categoriesArray.map((name, index) => ({
							id: index + 1,
							name: name,
							supercategory: 'none',
						})),
					},
					null,
					2
				)
			);
			break;

		case 'pascal':
			annotations.push(`<?xml version="1.0"?>
<annotation>
    <size>
        <width>${imageWidth}</width>
        <height>${imageHeight}</height>
        <depth>3</depth>
    </size>`);

			objects.forEach((obj) => {
				const x1 = Math.max(0, obj.left - imgBounds.left);
				const y1 = Math.max(0, obj.top - imgBounds.top);
				const x2 = Math.min(imageWidth, x1 + obj.width);
				const y2 = Math.min(imageHeight, y1 + obj.height);

				annotations.push(`    <object>
        <name>${obj.category}</name>
        <bndbox>
            <xmin>${Math.round(x1)}</xmin>
            <ymin>${Math.round(y1)}</ymin>
            <xmax>${Math.round(x2)}</xmax>
            <ymax>${Math.round(y2)}</ymax>
        </bndbox>
    </object>`);
			});

			annotations.push('</annotation>');
			break;
	}

	// Descargar archivo
	const blob = new Blob([annotations.join('\n')], {
		type: format === 'pascal' ? 'text/xml' : 'text/plain',
	});
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `annotations.${format === 'coco' ? 'json' : format === 'pascal' ? 'xml' : 'txt'}`;
	link.click();
});

// Eliminar categoría y sus etiquetas
deleteCategory.addEventListener('click', () => {
	const selectedCategory = categorySelect.value;
	if (!selectedCategory) {
		alert('Seleccione una categoría para eliminar.');
		return;
	}

	if (confirm(`¿Está seguro de eliminar la categoría "${selectedCategory}" y todas sus etiquetas?`)) {
		// Eliminar rectángulos de la categoría
		canvas
			.getObjects('rect')
			.filter((obj) => obj.category === selectedCategory)
			.forEach((obj) => canvas.remove(obj));

		// Eliminar categoría
		delete categories[selectedCategory];
		categorySelect.remove(categorySelect.selectedIndex);
		canvas.renderAll();
	}
});

// Manejar teclas de borrado
document.addEventListener('keydown', (event) => {
	if ((event.key === 'Delete' || event.key === 'Backspace') && canvas.getActiveObject()) {
		canvas.remove(canvas.getActiveObject());
		canvas.renderAll();
	}
});
