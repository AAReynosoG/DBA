const GeneradorReporte = require('./generador');
const Process = require('./utils/Process');
const metricas = {
    mysql: {}
};

(async () =>{

    const tablesManagement = new Process("mysql");
    tablesManagement.ProcessArguments.push("-uroot");
    tablesManagement.ProcessArguments.push("--password=token1234");
    tablesManagement.Execute();
    tablesManagement.Write("DROP DATABASE IF EXISTS students;");
    tablesManagement.Write("CREATE DATABASE IF NOT EXISTS students;");
    tablesManagement.Write("USE students;");
    tablesManagement.Write("CREATE TABLE IF NOT EXISTS student (user_id INT, s_year INT, s_name VARCHAR(50));");
    tablesManagement.Write("CREATE TABLE IF NOT EXISTS exported_data (x INT, y INT, z VARCHAR(50));");
    tablesManagement.End();
    await tablesManagement.Finish();
    if (tablesManagement.Logs) console.log(`Logs: ${tablesManagement.Logs}`);
    if (tablesManagement.ErrorsLog) console.error(`Error during export: ${tablesManagement.ErrorsLog}`);
    metricas.mysql.tablesManagementTime = tablesManagement.EndTime - tablesManagement.StartTime;
    console.log(`Tables Management Timer: ${(metricas.mysql.tablesManagementTime)}`);

    const loadData = new Process("mysql");
    loadData.ProcessArguments.push("-uroot");
    loadData.ProcessArguments.push("--password=token1234");
    loadData.Execute();
    loadData.Write("LOAD DATA INFILE 'C:/Users/mzpra/OneDrive/Documentos/temp/data.txt' INTO TABLE students.student FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';");
    loadData.End();
    await loadData.Finish();
    if (loadData.Logs) console.log(`Logs: ${loadData.Logs}`);
    if (loadData.ErrorsLog) console.error(`Error during export: ${loadData.ErrorsLog}`);
    metricas.mysql.importDataTime = loadData.EndTime - loadData.StartTime;
    console.log(`Import Data to Students Timer: ${(metricas.mysql.importDataTime)}`);


    const exportData = new Process("mysql");
    exportData.ProcessArguments.push("-uroot");
    exportData.ProcessArguments.push("--password=token1234");
    exportData.Execute();
    exportData.Write("USE students;");
    exportData.Write("SELECT * FROM student WHERE s_year >= 100 AND s_year <= 760 INTO OUTFILE 'C:/Users/mzpra/OneDrive/Documentos/temp/exported_data.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';");
    exportData.End();
    await exportData.Finish();
    if (exportData.Logs) console.log(`Logs: ${exportData.Logs}`);
    if (exportData.ErrorsLog) console.error(`Error during export: ${exportData.ErrorsLog}`);
    metricas.mysql.exportDataTime = exportData.EndTime - exportData.StartTime;
    console.log(`Export Data Timer: ${(metricas.mysql.exportDataTime)}`);


    const loadDataXYZ = new Process("mysql");
    loadDataXYZ.ProcessArguments.push("-uroot");
    loadDataXYZ.ProcessArguments.push("--password=token1234");
    loadDataXYZ.Execute();
    loadDataXYZ.Write("LOAD DATA INFILE 'C:/Users/mzpra/OneDrive/Documentos/temp/exported_data.txt' INTO TABLE students.exported_data FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';");
    loadDataXYZ.End();
    await loadDataXYZ.Finish();
    if (loadDataXYZ.Logs) console.log(`Logs: ${loadDataXYZ.Logs}`);
    if (loadDataXYZ.ErrorsLog) console.error(`Error during export: ${loadDataXYZ.ErrorsLog}`);
    metricas.mysql.importDataXYZTime = loadDataXYZ.EndTime - loadDataXYZ.StartTime;
    console.log(`Import Data to XYZ Timer: ${(metricas.mysql.importDataXYZTime)}`);


    const reporte = new GeneradorReporte();
    const grafico = {
        type: 'bar',
        labels: "['Import Data to Student', 'Export Data from Student', 'Import Data to XYZ']",
        title: 'Data Loader',
        data: `[${metricas.mysql.importDataTime}, ${metricas.mysql.exportDataTime}, ${metricas.mysql.importDataXYZTime}]`
    };


    reporte.Body =
        `
    <main class='container'>
        <div>
            <canvas id="grafico-mongo"></canvas>
        </div>
        <script>
            const ctx = document.getElementById('grafico-mongo');
    
            new Chart(ctx, {
                type: '${grafico.type}',
                data: {
                    labels: ${grafico.labels},
                    datasets: [{
                        label: '${grafico.title}',
                        data: ${grafico.data},
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        </script>
    </main>
    `;
    reporte.Generar();
})();
/*
* mongosh --authenticationDatabase "admin" -u "root" -p=token1234
* mongosh --authenticationDatabase "admin" -u "root" -p
] } )
* */