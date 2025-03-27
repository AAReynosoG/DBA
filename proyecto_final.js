const fs = require('fs');
const CsvGen = require('./csv_generators');
const Randomizer = require('./randomizer');
const env = require('./.env');
const Process = require('./utils/Process');
const Stresser = require('./stresser');

const timers = {
    mysql: {},
    mongo: {}
};

const dbUser = env.DB_USER;
const dbPwd = env.DB_PASSWORD;
const fsPath = env.FS_PATH;
const secureFilePath = env.SECURE_FILE_PATH;

(async () => {
    let start;
    let end;

    fs.unlink(fsPath + 'licencias.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de licencias: ${err}`)
        }
    });

    fs.unlink(fsPath + 'autoresCSV.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de autoresCSV: ${err}`)
        }
    });

    fs.unlink(fsPath + 'librosCSV.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de librosCSV: ${err}`)
        }
    });

    const NUM = 100_000;
    const NUM_2 = 150_000;
    const uniqueIds = Randomizer.generateUniqueIds(NUM);
    const uniqueLicences = Randomizer.generateUniqueLicences(NUM_2);

    fs.writeFileSync(fsPath + 'autores.txt', CsvGen.generateAuthorsCSVData(NUM_2, uniqueIds, uniqueLicences));
    console.log("Archivo de autores generado");

    let startTime = Date.now();
    fs.writeFileSync(fsPath + 'libros.txt', CsvGen.generateBooksCSVData(NUM, uniqueLicences, uniqueIds, fsPath));
    let endTime = Date.now();
    timers.mysql.booksGenerationTime = (endTime - startTime)/1000;

    console.log(`Tiempo de generación de libros: ${timers.mysql.booksGenerationTime} segundos`);
    console.log("Archivo de libros generado");

    /*TODO: Cargar información de Autores necesaria para generar libros.*/
    const csvDataToAuthor = new Process("mysql");
    csvDataToAuthor.ProcessArguments.push(`-u${dbUser}`);
    csvDataToAuthor.ProcessArguments.push(`--password=${dbPwd}`);
    csvDataToAuthor.Execute();
    csvDataToAuthor.Write(`LOAD DATA INFILE '${secureFilePath}autores.txt' INTO TABLE proyecto_final.Autor FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (license, name, lastName, secondLastName, year) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToAuthor.End();
    await csvDataToAuthor.Finish();
    if (csvDataToAuthor.ErrorsLog) console.error(`Error during export: ${csvDataToAuthor.ErrorsLog}`);
    timers.mysql.csvDataToAuthorTime = (csvDataToAuthor.EndTime - csvDataToAuthor.StartTime)/1000;
    console.log(`Tiempo de CSV a Autor: ${(timers.mysql.csvDataToAuthorTime)}`);

    /*TODO: Cargar archivo csv con 100k datos a Libros*/
    const csvDataToBook = new Process("mysql");
    csvDataToBook.ProcessArguments.push(`-u${dbUser}`);
    csvDataToBook.ProcessArguments.push(`--password=${dbPwd}`);
    csvDataToBook.Execute();
    csvDataToBook.Write(`LOAD DATA INFILE '${secureFilePath}libros.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToBook.End();
    await csvDataToBook.Finish();
    if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    timers.mysql.csvDataToBookTime = (csvDataToBook.EndTime - csvDataToBook.StartTime)/1000;
    console.log(`Tiempo de CSV a Libro: ${(timers.mysql.csvDataToBookTime)}`);


    /*TODO: Obtener licencias existentes*/
    const getLicenses = new Process("mysql");
    getLicenses.ProcessArguments.push(`-u${dbUser}`);
    getLicenses.ProcessArguments.push(`--password=${dbPwd}`);
    getLicenses.Execute();
    getLicenses.Write(`SELECT license FROM proyecto_final.Autor INTO OUTFILE '${secureFilePath}licencias.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    getLicenses.End();
    await getLicenses.Finish();
    if (getLicenses.ErrorsLog) console.error(`Error during export: ${getLicenses.ErrorsLog}`);
    timers.mysql.getLicensesTime = (getLicenses.EndTime - getLicenses.StartTime)/1000;
    console.log(`Tiempo de obtener licencias: ${(timers.mysql.getLicensesTime)}`);

    const existingLicenses = fs.readFileSync(fsPath + 'licencias.txt', 'utf-8')
        .split('\n')
        .filter(license => license !== '');


    /*TODO: Estresar la BD con 3500 Libros*/
    start = Date.now()
    for(let i= 0; i < 35; i++){
        await Stresser.mysqlStresser(10, 10, existingLicenses, dbUser, dbPwd)
    }
    end = Date.now()
    timers.mysql.stressTime = (end - start)/1000
    console.log(`Tiempo en estresar la BD: ${timers.mysql.stressTime}`)


    /*TODO: Generar 100 archivos con 1000 de libros registros cada uno.*/
    const FILES_QUANTITY = 100;
    const RECORDS_QUANTITY = 1000;
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        fs.writeFileSync(fsPath + `libros${i}.txt`, CsvGen.generateBooksCSVData(RECORDS_QUANTITY, existingLicenses, uniqueIds, fsPath));
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesTimer = (end - start)/1000
    console.log(`Tiempo en generar 100 archivos de libros: ${timers.mysql.oneHundredBookFilesTimer}`)


    /*TODO: Esos 100 archivos exportarlos a MYSQL*/
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        const csvDataToBook = new Process("mysql");
        csvDataToBook.ProcessArguments.push(`-u${dbUser}`);
        csvDataToBook.ProcessArguments.push(`--password=${dbPwd}`);
        csvDataToBook.Execute();
        csvDataToBook.Write(`LOAD DATA INFILE '${secureFilePath}libros${i}.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
        csvDataToBook.End();
        await csvDataToBook.Finish();
        if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesToMysqlTimer = (end - start)/1000
    console.log(`Tiempo en exportar 100 archivos de libros a MySQL: ${timers.mysql.oneHundredBookFilesToMysqlTimer}`)


    /*TODO: El mayor número de paginas, menor número de páginas, el promedio de número de páginas, el año más cercano a la actualidad, el año más antigüo, y el número total de libros.*/
    const complexQuery = new Process("mysql");
    complexQuery.ProcessArguments.push(`-u${dbUser}`);
    complexQuery.ProcessArguments.push(`--password=${dbPwd}`);
    complexQuery.Execute();
    complexQuery.Write(`
    SELECT 
        MAX(pages), 
        MIN(pages), 
        AVG(pages),
        (SELECT year
        FROM proyecto_final.Libro
        ORDER BY ABS(CAST(year AS SIGNED) - CAST(YEAR(CURDATE()) AS SIGNED)) ASC LIMIT 1) AS closest_year,
        MIN(year), 
        COUNT(*) FROM proyecto_final.Libro;`);
    complexQuery.End();
    await complexQuery.Finish();
    console.log(`Logs: ${complexQuery.Logs}`);
    if (complexQuery.ErrorsLog) console.error(`Error during export: ${complexQuery.ErrorsLog}`);
    timers.mysql.complexQueryTime = (complexQuery.EndTime - complexQuery.StartTime)/1000;
    console.log(`Tiempo de la consulta compleja: ${(timers.mysql.complexQueryTime)}`);

    /*TODO: Ambas tablas a csv*/
    const bothToCsv = new Process("mysql");
    bothToCsv.ProcessArguments.push(`-u${dbUser}`);
    bothToCsv.ProcessArguments.push(`--password=${dbPwd}`);
    bothToCsv.Execute();
    bothToCsv.Write(`SELECT * FROM proyecto_final.Autor INTO OUTFILE '${secureFilePath}autoresCSV.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    bothToCsv.Write(`SELECT * FROM proyecto_final.Libro INTO OUTFILE '${secureFilePath}librosCSV.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    bothToCsv.End();
    await bothToCsv.Finish();
    if (bothToCsv.ErrorsLog) console.error(`Error during export: ${bothToCsv.ErrorsLog}`);
    timers.mysql.bothToCsvTime = (bothToCsv.EndTime - bothToCsv.StartTime)/1000;
    console.log(`Tiempo tras mandar ambas tablas a csv: ${(timers.mysql.bothToCsvTime)}`);



})()
