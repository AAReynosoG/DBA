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


(async () => {
    const DB_USER = env.DB_USER;
    const DB_PWD = env.DB_PASSWORD;
    const FS_PATH = env.FS_PATH;
    const SECURE_FILE_PATH = env.SECURE_FILE_PATH;
    const MYSQL_PROCESS = env.MYSQL_PROCESS;

    let start;
    let end;

    fs.unlink(FS_PATH + 'licencias.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de licencias: ${err}`)
        }
    });

    fs.unlink(FS_PATH + 'autoresCSV.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de autoresCSV: ${err}`)
        }
    });

    fs.unlink(FS_PATH + 'librosCSV.txt', (err) => {
        if (err) {
            console.error(`Error al borrar archivo de librosCSV: ${err}`)
        }
    });

    const NUM = 100_000;
    const NUM_2 = 150_000;
    const uniqueIds = Randomizer.generateUniqueIds(NUM);
    const uniqueLicences = Randomizer.generateUniqueLicences(NUM_2);

    fs.writeFileSync(FS_PATH + 'autores.txt', CsvGen.generateAuthorsCSVData(NUM_2, uniqueIds, uniqueLicences));
    console.log("Archivo de autores generado");

    start = Date.now();
    fs.writeFileSync(FS_PATH + 'libros.txt', CsvGen.generateBooksCSVData(NUM, uniqueLicences, uniqueIds, FS_PATH));
    end = Date.now();
    timers.mysql.booksGenerationTime = (end - start)/1000;

    console.log(`Tiempo de generación de libros: ${timers.mysql.booksGenerationTime} segundos`);
    console.log("Archivo de libros generado");


    /*TODO: Cargar información de Autores necesaria para generar libros.*/
    const csvDataToAuthor = new Process(MYSQL_PROCESS);
    csvDataToAuthor.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToAuthor.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToAuthor.Execute();
    csvDataToAuthor.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}autores.txt' INTO TABLE proyecto_final.Autor FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (license, name, lastName, secondLastName, year) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToAuthor.End();
    await csvDataToAuthor.Finish();
    if (csvDataToAuthor.ErrorsLog) console.error(`Error during export: ${csvDataToAuthor.ErrorsLog}`);
    timers.mysql.csvDataToAuthorTime = (csvDataToAuthor.EndTime - csvDataToAuthor.StartTime)/1000;
    console.log(`Tiempo de CSV a Autor: ${(timers.mysql.csvDataToAuthorTime)}`);


    /*TODO: Cargar archivo csv con 100k datos a Libros*/
    const csvDataToBook = new Process(MYSQL_PROCESS);
    csvDataToBook.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToBook.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToBook.Execute();
    csvDataToBook.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}libros.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToBook.End();
    await csvDataToBook.Finish();
    if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    timers.mysql.csvDataToBookTime = (csvDataToBook.EndTime - csvDataToBook.StartTime)/1000;
    console.log(`Tiempo de CSV a Libro: ${(timers.mysql.csvDataToBookTime)}`);


    /*TODO: Obtener licencias existentes*/
    const getLicenses = new Process(MYSQL_PROCESS);
    getLicenses.ProcessArguments.push(`-u${DB_USER}`);
    getLicenses.ProcessArguments.push(`--password=${DB_PWD}`);
    getLicenses.Execute();
    getLicenses.Write(`SELECT license FROM proyecto_final.Autor INTO OUTFILE '${SECURE_FILE_PATH}licencias.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    getLicenses.End();
    await getLicenses.Finish();
    if (getLicenses.ErrorsLog) console.error(`Error during export: ${getLicenses.ErrorsLog}`);
    timers.mysql.getLicensesTime = (getLicenses.EndTime - getLicenses.StartTime)/1000;
    console.log(`Tiempo de obtener licencias: ${(timers.mysql.getLicensesTime)}`);

    const existingLicenses = fs.readFileSync(FS_PATH + 'licencias.txt', 'utf-8')
        .split('\n')
        .filter(license => license !== '');


    /*TODO: Estresar la BD con 3500 Libros*/
    start = Date.now()
    for(let i= 0; i < 35; i++){
        await Stresser.mysqlStresser(10, 10, existingLicenses, DB_USER, DB_PWD)
    }
    end = Date.now()
    timers.mysql.stressTime = (end - start)/1000
    console.log(`Tiempo en estresar la BD: ${timers.mysql.stressTime}`)


    /*TODO: Generar 100 archivos con 1000 de libros registros cada uno.*/
    const FILES_QUANTITY = 100;
    const RECORDS_QUANTITY = 1000;
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        fs.writeFileSync(FS_PATH + `libros${i}.txt`, CsvGen.generateBooksCSVData(RECORDS_QUANTITY, existingLicenses, uniqueIds, FS_PATH));
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesTimer = (end - start)/1000
    console.log(`Tiempo en generar 100 archivos de libros: ${timers.mysql.oneHundredBookFilesTimer}`)


    /*TODO: Esos 100 archivos exportarlos a MYSQL*/
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        const csvDataToBook = new Process(MYSQL_PROCESS);
        csvDataToBook.ProcessArguments.push(`-u${DB_USER}`);
        csvDataToBook.ProcessArguments.push(`--password=${DB_PWD}`);
        csvDataToBook.Execute();
        csvDataToBook.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}libros${i}.txt' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
        csvDataToBook.End();
        await csvDataToBook.Finish();
        if (csvDataToBook.ErrorsLog) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesToMysqlTimer = (end - start)/1000
    console.log(`Tiempo en exportar 100 archivos de libros a MySQL: ${timers.mysql.oneHundredBookFilesToMysqlTimer}`)


    /*TODO: El mayor número de paginas, menor número de páginas, el promedio de número de páginas, el año más cercano a la actualidad, el año más antigüo, y el número total de libros.*/
    const complexQuery = new Process(MYSQL_PROCESS);
    complexQuery.ProcessArguments.push(`-u${DB_USER}`);
    complexQuery.ProcessArguments.push(`--password=${DB_PWD}`);
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
    const bothToCsv = new Process(MYSQL_PROCESS);
    bothToCsv.ProcessArguments.push(`-u${DB_USER}`);
    bothToCsv.ProcessArguments.push(`--password=${DB_PWD}`);
    bothToCsv.Execute();
    bothToCsv.Write(`SELECT * FROM proyecto_final.Autor INTO OUTFILE '${SECURE_FILE_PATH}autoresCSV.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    bothToCsv.Write(`SELECT * FROM proyecto_final.Libro INTO OUTFILE '${SECURE_FILE_PATH}librosCSV.txt' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    bothToCsv.End();
    await bothToCsv.Finish();
    if (bothToCsv.ErrorsLog) console.error(`Error during export: ${bothToCsv.ErrorsLog}`);
    timers.mysql.bothToCsvTime = (bothToCsv.EndTime - bothToCsv.StartTime)/1000;
    console.log(`Tiempo tras mandar ambas tablas a csv: ${(timers.mysql.bothToCsvTime)}`);

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
    * Tiempo que toma importar el respaldo de MongoDB
    * Usa los arhicovs autoresBackup.txt y librosBackup.txt generados en el paso anterior
    * para importarlos a MongoDB
    * */

    const authorMongoBackup = new Process('mongoimport');
    authorMongoBackup.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    authorMongoBackup.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    authorMongoBackup.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
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
    bookMongoBackup.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    bookMongoBackup.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    bookMongoBackup.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
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
    * Exporta los datos de MongoDB a los archivos autoresMongoBackup.txt y librosMongoBackup.txt
    * */

    const authorMongoExport = new Process('mongoexport');
    authorMongoExport.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    authorMongoExport.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    authorMongoExport.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
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
    bookMongoExport.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    bookMongoExport.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    bookMongoExport.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
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


  /*
    * Tiempo que toma restaurar el respaldo de MongoDB en MsSQL
    * tomar los archivos generados en el paso anterior y restaurarlos en MySQL
    * */

  const authorMongoRestore = new Process(MYSQL_PROCESS);
  authorMongoRestore.ProcessArguments.push(`-u${DB_USER}`);
  authorMongoRestore.ProcessArguments.push(`--password=${DB_PWD}`);
  authorMongoRestore.Execute();
  authorMongoRestore.Write(`
    LOAD DATA INFILE '${SECURE_FILE_PATH}autoresMongoBackup.txt' 
    INTO TABLE proyecto_final.Autor 
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
  `);

  authorMongoRestore.End();
  await authorMongoRestore.Finish();
  if (authorMongoRestore.ErrorsLog) console.error(`Error during export: ${authorMongoRestore.ErrorsLog}`);
  timers.mongo.mongoRestoreTime = authorMongoRestore.EndTime - authorMongoRestore.StartTime;
  console.log(`Tiempo de restauración de MongoDB: ${(timers.mongo.mongoRestoreTime)}`);

  const bookMongoRestore = new Process(MYSQL_PROCESS);
  bookMongoRestore.ProcessArguments.push(`-u${DB_USER}`);
  bookMongoRestore.ProcessArguments.push(`--password=${DB_PWD}`);
  bookMongoRestore.Execute();
  bookMongoRestore.Write(`
    LOAD DATA INFILE '${SECURE_FILE_PATH}librosMongoBackup.txt' 
    INTO TABLE proyecto_final.Libro 
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
  `);
  bookMongoRestore.End();
  await bookMongoRestore.Finish();
  if (bookMongoRestore.ErrorsLog) console.error(`Error during export: ${bookMongoRestore.ErrorsLog}`);
  timers.mongo.mongoRestoreTime = bookMongoRestore.EndTime - bookMongoRestore.StartTime;
  console.log(`Tiempo de restauración de MongoDB: ${(timers.mongo.mongoRestoreTime)}`);


  /*
    * Tiempo total que toma realizar un dump completo de la base de datos de MySQL
    * y luego borrar su contenido (vaciar tablas o eliminar la base de datos)
    * */

  const startTime = Date.now();
  const fullDump = new Process('mysqldump');
  fullDump.ProcessArguments.push(`-u${DB_USER}`);
  fullDump.ProcessArguments.push(`--password=${DB_PWD}`);
  fullDump.ProcessArguments.push('proyecto_final');
  fullDump.ProcessArguments.push(`--result-file=${SECURE_FILE_PATH}fullDump.sql`);

  fullDump.Execute();
  await fullDump.Finish();

  const clearDatabase = new Process('mysql');
  clearDatabase.ProcessArguments.push(`-u${DB_USER}`);
  clearDatabase.ProcessArguments.push(`--password=${DB_PWD}`);
  clearDatabase.ProcessArguments.push('-e');
  clearDatabase.ProcessArguments.push('DROP DATABASE IF EXISTS proyecto_final; CREATE DATABASE proyecto_final;');

  clearDatabase.Execute();
  await clearDatabase.Finish();

  const endTime = Date.now();
  timers.mysql.fullDumpTime = endTime - startTime;
  console.log(`Tiempo total de dump y vaciado de MYSQL completo en: ${(timers.mysql.fullDumpTime)} ms`);


  /*
    * Tiempo que toma importar de nuevo
    * el dump completo de MYSQL
    * */

  const fullDumpImport = new Process(MYSQL_PROCESS);
  fullDumpImport.ProcessArguments.push(`-u${DB_USER}`);
  fullDumpImport.ProcessArguments.push(`--password=${DB_PWD}`);
  fullDumpImport.ProcessArguments.push(`--database=proyecto_final`);
  fullDumpImport.Execute();
  fullDumpImport.Write(`SOURCE ${SECURE_FILE_PATH}fullDump.sql`);
  fullDumpImport.End();
  await fullDumpImport.Finish();
  if (fullDumpImport.ErrorsLog) console.error(`Error during export: ${fullDumpImport.ErrorsLog}`);
  timers.mysql.fullDumpImportTime = fullDumpImport.EndTime - fullDumpImport.StartTime;
  console.log(`Tiempo de importación de dump completo de MYSQL: ${(timers.mysql.fullDumpImportTime)}`);

  /*
    * 
    * Calcular el tiempo cuando el usuario C intenta insertar 
    * en la tabla Autor
    * */

  /* const userCInsert = new Process(MYSQL_PROCESS);
  userCInsert.ProcessArguments.push('-uC');
  userCInsert.ProcessArguments.push('-ptoken1234')
  userCInsert.ProcessArguments.push(`-e`);
  userCInsert.ProcessArguments.push(`INSERT INTO proyecto_final.Autor (license, name, lastName, secondLastName, year) VALUES ('${Randomizer.generateLicense()}', 'Juan', 'Perez', 'Gomez', 1990);`); */





})()
