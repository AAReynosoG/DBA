const fs = require('fs');
const CsvGen = require('./csv_generators');
const Randomizer = require('./randomizer');
const env = require('./.env');
const Process = require('./utils/Process');
const timers = {
    mysql: {},
    mongo: {}
};
const DB_USER = env.DB_USER;
const DB_PWD = env.DB_PASSWORD;
const FS_PATH = env.FS_PATH;
const SECURE_FILE_PATH = env.SECURE_FILE_PATH;
const MYSQL_PROCESS = env.MYSQL_PROCESS;

(async () => {
    const NUM = 100_000;
    const uniqueIds = Randomizer.generateUniqueIds(NUM);
    const uniqueLicences = Randomizer.generateUniqueLicences(NUM);

    fs.writeFileSync(FS_PATH + 'autores.txt', CsvGen.generateAuthorsCSVData(NUM, uniqueIds, uniqueLicences));
    console.log("Archivo de autores generado");

    const authorLicences = fs.readFileSync(FS_PATH + 'autores.txt', 'utf-8')
        .split('\n')
        .map(line => line.split(',')[1])
        .filter(licence => licence);
    console.log(authorLicences.length);

    let startTime = Date.now();
    CsvGen.generateBooksCSVData(NUM, authorLicences, uniqueIds, FS_PATH)
    let endTime = Date.now();
    timers.mysql.booksGenerationTime = (endTime - startTime)/1000;

    console.log(`Tiempo de generación de libros: ${timers.mysql.booksGenerationTime} segundos`);
    console.log("Archivo de libros generado");

    const csvDataToAuthor = new Process(MYSQL_PROCESS);
    csvDataToAuthor.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToAuthor.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToAuthor.Execute();
    csvDataToAuthor.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}autores.txt' INTO TABLE proyecto_final.Autor FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    csvDataToAuthor.End();
    await csvDataToAuthor.Finish();
    if (csvDataToAuthor.ErrorsLog) console.error(`Error during export: ${csvDataToAuthor.ErrorsLog}`);
    timers.mysql.csvDataToAuthorTime = csvDataToAuthor.EndTime - csvDataToAuthor.StartTime;
    console.log(`Tiempo de CSV a Autor: ${(timers.mysql.csvDataToAuthorTime)}`);

    const csvDataToBook = new Process(MYSQL_PROCESS);
    csvDataToBook.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToBook.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToBook.Execute();
    console.log('Cargando datos de libros a MySQL');
    csvDataToBook.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}libros.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    
    csvDataToBook.End();
    await csvDataToBook.Finish();
    if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    timers.mysql.csvDataToBookTime = csvDataToBook.EndTime - csvDataToBook.StartTime;
    console.log(`Tiempo de CSV a Libro: ${(timers.mysql.csvDataToBookTime)}`);


  /*
    *  El tiempo que toma respaldar ambas tablas a MongoDB, eliminarlas de MySQL, exportar 
    *  el respaldo de MongoDB y restaurarlo en MySQL.
    * */


  /*
    * Tiempo que toma respaldar ambas tablas a MongoDB
    * */

    const tablesBackup = new Process(MYSQL_PROCESS);
    tablesBackup.ProcessArguments.push(`-u${DB_USER}`);
    tablesBackup.ProcessArguments.push(`--password=${DB_PWD}`);
    tablesBackup.Execute();

    tablesBackup.Write(`
      SELECT 'id', 'license', 'name', 'lastName', 'secondLastName', 'year'
      UNION
      SELECT id, license, name, lastName, secondLastName, year
      FROM proyecto_final.Autor
      INTO OUTFILE '${SECURE_FILE_PATH}autoresBackup.txt'
      FIELDS TERMINATED BY ',' 
      ENCLOSED BY '"'
      LINES TERMINATED BY '\n';
    `);
    tablesBackup.End();
    await tablesBackup.Finish();
    if (tablesBackup.ErrorsLog) console.error(`Error during export: ${tablesBackup.ErrorsLog}`);

    tablesBackup.Execute();
    tablesBackup.Write(`
      SELECT 'id', 'ISBN', 'title', 'autor_license', 'editorial', 'pages', 'year', 'genre', 'language', 'format', 'sinopsis', 'content'
      UNION
      SELECT id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content
      FROM proyecto_final.Libro
      INTO OUTFILE '${SECURE_FILE_PATH}librosBackup.txt'
      FIELDS TERMINATED BY ',' 
      ENCLOSED BY '"'
      LINES TERMINATED BY '\n'
    `); 
    tablesBackup.End();
    await tablesBackup.Finish();
    if (tablesBackup.ErrorsLog) console.error(`Error during export: ${tablesBackup.ErrorsLog}`);
    timers.mysql.tablesBackupTime = tablesBackup.EndTime - tablesBackup.StartTime;
    console.log(`Tiempo de respaldo de tablas: ${(timers.mysql.tablesBackupTime)}`);


  /*
    * Tiempo que toma eliminar las tablas de MySQL
    * */

    const dropTables = new Process(MYSQL_PROCESS);
    dropTables.ProcessArguments.push(`-u${DB_USER}`);
    dropTables.ProcessArguments.push(`--password=${DB_PWD}`);
    dropTables.Execute();
    dropTables.Write(`DELETE FROM proyecto_final.Libro;`);
    dropTables.End();
    await dropTables.Finish();
    if (dropTables.ErrorsLog) console.error(`Error during export: ${dropTables.ErrorsLog}`);
    dropTables.Execute();
    dropTables.Write(`DELETE FROM proyecto_final.Autor;`);
    dropTables.End();
    await dropTables.Finish();
    if (dropTables.ErrorsLog) console.error(`Error during export: ${dropTables.ErrorsLog}`);
    timers.mysql.dropTablesTime = dropTables.EndTime - dropTables.StartTime;
    console.log(`Tiempo de eliminación de tablas: ${(timers.mysql.dropTablesTime)}`);


  /*
    * Tiempo que toma exportar el respaldo de MongoDB
    * */

    const authorMongoBackup = new Process('mongoimport');
    authorMongoBackup.ProcessArguments.push('--db=proyecto_final');
    authorMongoBackup.ProcessArguments.push('--collection=Autor');
    authorMongoBackup.ProcessArguments.push('--type=csv');
    authorMongoBackup.ProcessArguments.push(`--file=${SECURE_FILE_PATH}autoresBackup.txt`);
    authorMongoBackup.ProcessArguments.push('--headerline');
    authorMongoBackup.Execute();
    await authorMongoBackup.Finish();
    if (authorMongoBackup.ErrorsLog) console.error(`Error during export: ${authorMongoBackup.ErrorsLog}`);
    timers.mongo.mongoBackupTime = authorMongoBackup.EndTime - authorMongoBackup.StartTime;
    console.log(`Tiempo de respaldo de MongoDB: ${(timers.mongo.mongoBackupTime)}`);

    const bookMongoBackup = new Process('mongoimport');
    bookMongoBackup.ProcessArguments.push('--db=proyecto_final');
    bookMongoBackup.ProcessArguments.push('--collection=Libro');
    bookMongoBackup.ProcessArguments.push('--type=csv');
    bookMongoBackup.ProcessArguments.push(`--file=${SECURE_FILE_PATH}librosBackup.txt`);
    bookMongoBackup.ProcessArguments.push('--headerline');
    bookMongoBackup.Execute();
    await bookMongoBackup.Finish();
    if (bookMongoBackup.ErrorsLog) console.error(`Error during export: ${bookMongoBackup.ErrorsLog}`);
    timers.mongo.mongoBackupTime = bookMongoBackup.EndTime - bookMongoBackup.StartTime;
    console.log(`Tiempo de respaldo de MongoDB: ${(timers.mongo.mongoBackupTime)}`);

  /*
    * Tiempo que toma exportar el respaldo de MongoDB
    * */

    const authorMongoExport = new Process('mongoexport');
    authorMongoExport.ProcessArguments.push('--db=proyecto_final');
    authorMongoExport.ProcessArguments.push('--collection=Autor');
    authorMongoExport.ProcessArguments.push('--type=csv');
    authorMongoExport.ProcessArguments.push('--fields=id,license,name,lastName,secondLastName,year');
    authorMongoExport.ProcessArguments.push(`--out=${SECURE_FILE_PATH}autoresMongoBackup.txt`);
    authorMongoExport.Execute();
    await authorMongoExport.Finish();
    if (authorMongoExport.ErrorsLog) console.error(`Error during export: ${authorMongoExport.ErrorsLog}`);
    timers.mongo.mongoExportTime = authorMongoExport.EndTime - authorMongoExport.StartTime;
    console.log(`Tiempo de exportación de MongoDB: ${(timers.mongo.mongoExportTime)}`);


    const bookMongoExport = new Process('mongoexport');
    bookMongoExport.ProcessArguments.push('--db=proyecto_final');
    bookMongoExport.ProcessArguments.push('--collection=Libro');
    bookMongoExport.ProcessArguments.push('--type=csv');
    bookMongoExport.ProcessArguments.push('--fields=id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content');
    bookMongoExport.ProcessArguments.push(`--out=${SECURE_FILE_PATH}librosMongoBackup.txt`);
    bookMongoExport.Execute();
    await bookMongoExport.Finish();
    if (bookMongoExport.ErrorsLog) console.error(`Error during export: ${bookMongoExport.ErrorsLog}`);
    timers.mongo.mongoExportTime = bookMongoExport.EndTime - bookMongoExport.StartTime;
    console.log(`Tiempo de exportación de MongoDB: ${(timers.mongo.mongoExportTime)}`);
    
})()
