const fs = require('fs');
const CsvGen = require('./csv_generators');
const Randomizer = require('./randomizer');
const Process = require('./utils/Process');
const timers = {
    mysql: {},
    mongo: {}
};

const dbUser = "root";
const dbPwd = "token1234";
const fsPath = 'C:\\Users\\mzpra\\OneDrive\\Documentos\\Proyects\\8A2025\\';
const secureFilePath = 'C:/Users/mzpra/OneDrive/Documentos/Proyects/8A2025/';

(async () => {

    const NUM = 100_000;
    const uniqueIds = Randomizer.generateUniqueIds(NUM);
    const uniqueLicences = Randomizer.generateUniqueLicences(NUM);

    fs.writeFileSync(fsPath + 'autores.txt', CsvGen.generateAuthorsCSVData(NUM, uniqueIds, uniqueLicences));
    console.log("Archivo de autores generado");

    const authorLicences = fs.readFileSync(fsPath + 'autores.txt', 'utf-8')
        .split('\n')
        .map(line => line.split(',')[1])
        .filter(licence => licence);
    console.log(authorLicences.length);

    let startTime = Date.now();
    CsvGen.generateBooksCSVData(NUM, authorLicences, uniqueIds)
    let endTime = Date.now();
    timers.mysql.booksGenerationTime = (endTime - startTime)/1000;

    console.log(`Tiempo de generación de libros: ${timers.mysql.booksGenerationTime} segundos`);
    console.log("Archivo de libros generado");

    const csvDataToAuthor = new Process("mysql");
    csvDataToAuthor.ProcessArguments.push(`-u${dbUser}`);
    csvDataToAuthor.ProcessArguments.push(`--password=${dbPwd}`);
    csvDataToAuthor.Execute();
    csvDataToAuthor.Write(`LOAD DATA INFILE '${secureFilePath}autores.txt' INTO TABLE proyecto_final.Autor FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    csvDataToAuthor.End();
    await csvDataToAuthor.Finish();
    if (csvDataToAuthor.ErrorsLog) console.error(`Error during export: ${csvDataToAuthor.ErrorsLog}`);
    timers.mysql.csvDataToAuthorTime = csvDataToAuthor.EndTime - csvDataToAuthor.StartTime;
    console.log(`Tiempo de CSV a Autor: ${(timers.mysql.csvDataToAuthorTime)}`);

    const csvDataToBook = new Process("mysql");
    csvDataToBook.ProcessArguments.push("-uroot");
    csvDataToBook.ProcessArguments.push("--password=token1234");
    csvDataToBook.Execute();
    csvDataToBook.Write(`LOAD DATA INFILE '${secureFilePath}libros.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    csvDataToBook.End();
    await csvDataToBook.Finish();
    if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    timers.mysql.csvDataToBookTime = csvDataToBook.EndTime - csvDataToBook.StartTime;
    console.log(`Tiempo de CSV a Libro: ${(timers.mysql.csvDataToBookTime)}`);

})()