const FileStream = require('fs');

class GeneradorReporte {
    constructor() {
        this.body = null;
    }

    Generar() {
        const report = 
`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
    <script src="http://192.168.4.2:2025/chart.js"></script>
    <title>Rendimiento</title>
</head>

<style>
body {
    background-color: #383939;
}
</style>

<body>
    ${this.body}
</body>
</html>`;

        FileStream.writeFileSync("reporte.html", report);
    }

    get Body() {
        return this.body;
    }

    set Body(value) {
        this.body = value;
    }
}

module.exports = GeneradorReporte;