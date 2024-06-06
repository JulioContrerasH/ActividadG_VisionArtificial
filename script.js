// Definir la región de interés alrededor del punto proporcionado
var roi = ee.Geometry.Point([-77.5707, -8.9429]);

var geometry = ee.Geometry.Polygon(
  [[[-77.67839729085937, -8.79931671117352],
    [-77.67839729085937, -8.916519971292987],
    [-77.44922935262694, -8.916519971292987],
    [-77.44922935262694, -8.79931671117352]]], null, false);

// Filtrar la colección de imágenes Sentinel-2 TOA
var sentinel2 = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(roi)
  .filterDate('2023-01-01', '2023-12-31')
  .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', 10);

// Seleccionar la imagen con menor nubosidad
var image = sentinel2.sort('CLOUDY_PIXEL_PERCENTAGE').first().clip(geometry);

// Visualización en color natural
var naturalColorVis = {
  bands: ['B4', 'B3', 'B2'],
  min: 1078.7868177530281,
  max: 2921.85451381274,
  gamma: 1.4,
};

// Mostrar la imagen en color natural
Map.centerObject(roi, 10);
Map.addLayer(image, naturalColorVis, 'Natural Color');

// Seleccionar una banda para el procesamiento
var grayImage = image.select('B8');

// Aplicar diferentes filtros espaciales y morfológicos

// 1. Filtro Paso Bajo (Suavizado)
var lowPassKernel = ee.Kernel.gaussian({
  radius: 3,
  sigma: 1.5,
  units: 'pixels',
  normalize: true
});
var lowPass = grayImage.convolve(lowPassKernel).rename('lowPass');
Map.addLayer(lowPass, {min: 0, max: 3000}, 'Low Pass Filter', false);

// 2. Filtro Paso Alto (Afilado)
var highPassKernel = ee.Kernel.laplacian8();
var highPass = grayImage.convolve(highPassKernel).rename('highPass');
Map.addLayer(highPass, {min: -1, max: 1, palette: ['00FFFF', '000000']}, 'High Pass Filter', false);

// 3. Operador de Prewitt
var prewittX = ee.Kernel.fixed(3, 3, [
  [-1, 0, 1],
  [-1, 0, 1],
  [-1, 0, 1]
]);
var prewittY = ee.Kernel.fixed(3, 3, [
  [1, 1, 1],
  [0, 0, 0],
  [-1, -1, -1]
]);
var edgesPrewittX = grayImage.convolve(prewittX);
var edgesPrewittY = grayImage.convolve(prewittY);
var edgesPrewitt = edgesPrewittX.add(edgesPrewittY).rename('edgesPrewitt');
Map.addLayer(edgesPrewitt, {min: -1, max: 1, palette: ['00FFFF', '000000']}, 'Prewitt Edges', false);

// 4. Operador de Sobel
var sobel = ee.Kernel.sobel();
var edgesSobel = grayImage.convolve(sobel).rename('edgesSobel');
Map.addLayer(edgesSobel, {min: -1, max: 1, palette: ['00FFFF', '000000']}, 'Sobel Edges', false);

// 5. Operador de Canny
var cannyEdges = ee.Algorithms.CannyEdgeDetector({
  image: grayImage, 
  threshold: 10, 
  sigma: 1
}).rename('cannyEdges');
Map.addLayer(cannyEdges, {min: 0, max: 1, palette: ['00FFFF', '000000']}, 'Canny Edges', false);

// 6. Dilatación
var dilated = grayImage.focal_max(1).rename('dilated');
Map.addLayer(dilated, {min: 0, max: 3000}, 'Dilated', false);

// 7. Erosión
var eroded = grayImage.focal_min(1).rename('eroded');
Map.addLayer(eroded, {min: 0, max: 3000}, 'Eroded', false);

// 8. Apertura (Erosión seguida de Dilatación)
var opened = grayImage.focal_min(1).focal_max(1).rename('opened');
Map.addLayer(opened, {min: 0, max: 3000}, 'Opened', false);

// 9. Clausura (Dilatación seguida de Erosión)
var closed = grayImage.focal_max(1).focal_min(1).rename('closed');
Map.addLayer(closed, {min: 0, max: 3000}, 'Closed', false);

// 10. Gradiente Morfológico
var gradient = dilated.subtract(eroded).rename('gradient');
Map.addLayer(gradient, {min: -1, max: 1, palette: ['00FFFF', '000000']}, 'Morphological Gradient', false);

// 11. Top Hat
var tophat = grayImage.subtract(opened).rename('tophat');
Map.addLayer(tophat, {min: -1, max: 1, palette: ['00FFFF', '000000']}, 'Top Hat', false);
