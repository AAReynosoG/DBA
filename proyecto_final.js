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
    const DEBUG_MODE = false;

    let start;
    let end;

    const files = [
      'licencias.csv',
//      'autoresCSV.csv',
//      'librosCSV.csv',
      'autores.csv',
      'autoresBackup.csv',
      'librosBackup.csv',
      'autoresMongoBackup.csv',
      'librosMongoBackup.csv',
      'fullDump.sql',
      'mongo1mBooks.csv',
      'mongo1mBooksExportFields.csv'
    ];

    files.forEach(file => {
        const filePath = FS_PATH + file;

        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error al borrar archivo ${file}: ${err}`);
                } else {
                    console.log(`Archivo ${file} eliminado correctamente.`);
                }
            });
        }
    });

    const NUM = 100_000;
    const NUM_2 = 150_000;
    const uniqueIds = Randomizer.generateUniqueIds(NUM);
    const uniqueLicences = Randomizer.generateUniqueLicences(NUM_2);


    const tablesManagement = new Process(MYSQL_PROCESS);
    tablesManagement.ProcessArguments.push(`-u${DB_USER}`);
    tablesManagement.ProcessArguments.push(`--password=${DB_PWD}`);
    tablesManagement.Execute();
    tablesManagement.Write("CREATE TABLE IF NOT EXISTS proyecto_final.Autor(id BIGINT UNIQUE, license VARCHAR(12) NOT NULL UNIQUE, name TINYTEXT NOT NULL, lastName TINYTEXT, secondLastName TINYTEXT, year SMALLINT);");
    tablesManagement.Write("CREATE TABLE IF NOT EXISTS proyecto_final.Libro (id BIGINT UNIQUE, ISBN VARCHAR(16) NOT NULL, title VARCHAR(512) NOT NULL, autor_license VARCHAR(12), FOREIGN KEY (autor_license) REFERENCES Autor(license), editorial TINYTEXT, pages SMALLINT, year SMALLINT NOT NULL, genre TINYTEXT, language TINYTEXT NOT NULL, format TINYTEXT, sinopsis TEXT, content TEXT);");
    tablesManagement.End();
    await tablesManagement.Finish();
    if (tablesManagement.ErrorsLog) console.error(`Error during execution: ${tablesManagement.ErrorsLog}`);
    timers.mysql.tablesManagementTime = (tablesManagement.EndTime - tablesManagement.StartTime)/1000;
    console.log(`[0] Tiempo en crear tablas Autor y Libro: ${(timers.mysql.tablesManagementTime)} segundos`);

    start = Date.now();
    fs.writeFileSync(FS_PATH + 'autores.csv', CsvGen.generateAuthorsCSVData(NUM_2, uniqueIds, uniqueLicences));
    end = Date.now();
    timers.mysql.authorsGenerationTime = (end - start)/1000;
    console.log(`[1] Tiempo en crear 150,000 Autores: ${timers.mysql.authorsGenerationTime} segundos`);

    start = Date.now();
    fs.writeFileSync(FS_PATH + 'libros.csv', CsvGen.generateBooksCSVData(NUM, uniqueLicences, uniqueIds, FS_PATH));
    end = Date.now();
    timers.mysql.booksGenerationTime = (end - start)/1000;
    console.log(`[2] Tiempo en crear 100,000 libros: ${timers.mysql.booksGenerationTime} segundos`);


    /*TODO: Cargar información de Autores necesaria para generar libros.*/
    const csvDataToAuthor = new Process(MYSQL_PROCESS);
    csvDataToAuthor.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToAuthor.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToAuthor.Execute();
    csvDataToAuthor.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}autores.csv' INTO TABLE proyecto_final.Autor FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (license, name, lastName, secondLastName, year) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToAuthor.End();
    await csvDataToAuthor.Finish();
    if (csvDataToAuthor.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${csvDataToAuthor.ErrorsLog}`);
    timers.mysql.csvDataToAuthorTime = (csvDataToAuthor.EndTime - csvDataToAuthor.StartTime)/1000;
    console.log(`[3] Insertar datos a tabla Autor: ${(timers.mysql.csvDataToAuthorTime)} segundos`);


    /*TODO: Cargar archivo csv con 100k datos a Libros*/
    const csvDataToBook = new Process(MYSQL_PROCESS);
    csvDataToBook.ProcessArguments.push(`-u${DB_USER}`);
    csvDataToBook.ProcessArguments.push(`--password=${DB_PWD}`);
    csvDataToBook.Execute();
    csvDataToBook.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}libros.csv' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
    csvDataToBook.End();
    await csvDataToBook.Finish();
    if (csvDataToBook.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    timers.mysql.csvDataToBookTime = (csvDataToBook.EndTime - csvDataToBook.StartTime)/1000;
    console.log(`[4] Insertar datos en tabla Libro: ${(timers.mysql.csvDataToBookTime)} segundos`);


    /*TODO: Obtener licencias existentes*/
    const getLicenses = new Process(MYSQL_PROCESS);
    getLicenses.ProcessArguments.push(`-u${DB_USER}`);
    getLicenses.ProcessArguments.push(`--password=${DB_PWD}`);
    getLicenses.Execute();
    getLicenses.Write(`SELECT license FROM proyecto_final.Autor INTO OUTFILE '${SECURE_FILE_PATH}licencias.csv' FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n';`);
    getLicenses.End();
    await getLicenses.Finish();
    if (getLicenses.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${getLicenses.ErrorsLog}`);
    //timers.mysql.getLicensesTime = (getLicenses.EndTime - getLicenses.StartTime)/1000;

    const existingLicenses = fs.readFileSync(FS_PATH + 'licencias.csv', 'utf-8')
        .split('\n')
        .filter(license => license !== '');


    /*TODO: Estresar la BD con 3500 Libros*/
    start = Date.now()
    for(let i= 0; i < 35; i++){
        await Stresser.mysqlStresser(10, 10, existingLicenses, DB_USER, DB_PWD)
    }
    end = Date.now()
    timers.mysql.stressTime = (end - start)/1000
    console.log(`[6] Estresar la base de datos con 3,500 libros: ${timers.mysql.stressTime} segundos`)


    /*TODO: Generar 100 archivos con 1000 de libros registros cada uno.*/
    const FILES_QUANTITY = 100;
    const RECORDS_QUANTITY = 1000;
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        fs.writeFileSync(FS_PATH + `libros${i}.csv`, CsvGen.generateBooksCSVData(RECORDS_QUANTITY, existingLicenses, uniqueIds, FS_PATH));
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesTimer = (end - start)/1000
    console.log(`[7] Tiempo que toma generar 100 archivos: ${timers.mysql.oneHundredBookFilesTimer} segundos`)


    /*TODO: Esos 100 archivos exportarlos a MYSQL*/
    start = Date.now()
    for(let i = 0; i < FILES_QUANTITY; i++){
        const csvDataToBook = new Process(MYSQL_PROCESS);
        csvDataToBook.ProcessArguments.push(`-u${DB_USER}`);
        csvDataToBook.ProcessArguments.push(`--password=${DB_PWD}`);
        csvDataToBook.Execute();
        csvDataToBook.Write(`LOAD DATA INFILE '${SECURE_FILE_PATH}libros${i}.csv' INTO TABLE proyecto_final.Libro FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) SET id = UUID_SHORT() % 4294967295;`);
        csvDataToBook.End();
        await csvDataToBook.Finish();
        if (csvDataToBook.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${csvDataToBook.ErrorsLog}`);
    }
    end = Date.now()
    timers.mysql.oneHundredBookFilesToMysqlTimer = (end - start)/1000
    console.log(`[8] Tiempo que toma insertar 100 archivos to MYSLQ: ${timers.mysql.oneHundredBookFilesToMysqlTimer} segundos`)


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
    console.log(`Logs: ${complexQuery.Logs} `);
    if (complexQuery.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${complexQuery.ErrorsLog}`);
    timers.mysql.complexQueryTime = (complexQuery.EndTime - complexQuery.StartTime)/1000;
    console.log(`[9] Tiempo de la consulta compleja: ${(timers.mysql.complexQueryTime)} segundos`);

  /*
    *  El tiempo que toma respaldar ambas tablas a MongoDB, eliminarlas de MySQL, exportar 
    *  el respaldo de MongoDB y restaurarlo en MySQL.
    * */

  /*
    * Tiempo que toma respaldar ambas tablas a MongoDB
    * */
    
    // Iniciar contador de tiempo del primer punto
    // Abarca 4 bloques de procesos

    const tablesBackup = new Process(MYSQL_PROCESS);
    tablesBackup.ProcessArguments.push(`-u${DB_USER}`);
    tablesBackup.ProcessArguments.push(`--password=${DB_PWD}`);
    tablesBackup.Execute();

    tablesBackup.Write(`
      SELECT 'id', 'license', 'name', 'lastName', 'secondLastName', 'year'
      UNION
      SELECT id, license, name, lastName, secondLastName, year
      FROM proyecto_final.Autor
      INTO OUTFILE '${SECURE_FILE_PATH}autoresBackup.csv'
      FIELDS TERMINATED BY ',' 
      ENCLOSED BY '"'
      LINES TERMINATED BY '\n';
    `);
    tablesBackup.End();
    await tablesBackup.Finish();
    if (tablesBackup.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${tablesBackup.ErrorsLog}`);

    tablesBackup.Execute();
    tablesBackup.Write(`
      SELECT 'id', 'ISBN', 'title', 'autor_license', 'editorial', 'pages', 'year', 'genre', 'language', 'format', 'sinopsis', 'content'
      UNION
      SELECT id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content
      FROM proyecto_final.Libro
      INTO OUTFILE '${SECURE_FILE_PATH}librosBackup.csv'
      FIELDS TERMINATED BY ',' 
      ENCLOSED BY '"'
      LINES TERMINATED BY '\n'
    `); 
    tablesBackup.End();
    await tablesBackup.Finish();
    if (tablesBackup.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${tablesBackup.ErrorsLog}`);
    timers.mysql.tablesBackupTime = (tablesBackup.EndTime - tablesBackup.StartTime)/1000;
    console.log(`[10] Tiempo que toma exportar ambas tablas a CSV: ${(timers.mysql.tablesBackupTime)} segundos`);

  /*
    * Tiempo que toma eliminar las tablas de MySQL
    * */

    start = Date.now();
    const dropTables = new Process(MYSQL_PROCESS);
    dropTables.ProcessArguments.push(`-u${DB_USER}`);
    dropTables.ProcessArguments.push(`--password=${DB_PWD}`);
    dropTables.Execute();
    dropTables.Write(`DELETE FROM proyecto_final.Libro;`);
    dropTables.End();
    await dropTables.Finish();
    if (dropTables.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${dropTables.ErrorsLog}`);
    dropTables.Execute();
    dropTables.Write(`DELETE FROM proyecto_final.Autor;`);
    dropTables.End();
    await dropTables.Finish();
    if (dropTables.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${dropTables.ErrorsLog}`);


  /*
    * Tiempo que toma importar el respaldo de MongoDB
    * Usa los arhicovs autoresBackup.csv y librosBackup.csv generados en el paso anterior
    * para importarlos a MongoDB
    * */

    const authorMongoBackup = new Process('mongoimport');
    authorMongoBackup.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    authorMongoBackup.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    authorMongoBackup.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
    authorMongoBackup.ProcessArguments.push('--db=proyecto_final');
    authorMongoBackup.ProcessArguments.push('--collection=Autor');
    authorMongoBackup.ProcessArguments.push('--type=csv');
    authorMongoBackup.ProcessArguments.push(`--file=${SECURE_FILE_PATH}autoresBackup.csv`);
    authorMongoBackup.ProcessArguments.push('--headerline');
    authorMongoBackup.Execute();
    await authorMongoBackup.Finish();
    if (authorMongoBackup.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${authorMongoBackup.ErrorsLog}`);

    const bookMongoBackup = new Process('mongoimport');
    bookMongoBackup.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    bookMongoBackup.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    bookMongoBackup.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
    bookMongoBackup.ProcessArguments.push('--db=proyecto_final');
    bookMongoBackup.ProcessArguments.push('--collection=Libro');
    bookMongoBackup.ProcessArguments.push('--type=csv');
    bookMongoBackup.ProcessArguments.push(`--file=${SECURE_FILE_PATH}librosBackup.csv`);
    bookMongoBackup.ProcessArguments.push('--headerline');
    bookMongoBackup.Execute();
    await bookMongoBackup.Finish();
    if (bookMongoBackup.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${bookMongoBackup.ErrorsLog}`);

    
  /*
    * Tiempo que toma exportar el respaldo de MongoDB
    * Exporta los datos de MongoDB a los archivos autoresMongoBackup.csv y librosMongoBackup.csv
    * */

    const authorMongoExport = new Process('mongoexport');
    authorMongoExport.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    authorMongoExport.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    authorMongoExport.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
    authorMongoExport.ProcessArguments.push('--db=proyecto_final');
    authorMongoExport.ProcessArguments.push('--collection=Autor');
    authorMongoExport.ProcessArguments.push('--type=csv');
    authorMongoExport.ProcessArguments.push('--fields=id,license,name,lastName,secondLastName,year');
    authorMongoExport.ProcessArguments.push(`--out=${SECURE_FILE_PATH}autoresMongoBackup.csv`);
    authorMongoExport.Execute();
    await authorMongoExport.Finish();
    if (authorMongoExport.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${authorMongoExport.ErrorsLog}`);


    const bookMongoExport = new Process('mongoexport');
    bookMongoExport.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    bookMongoExport.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    bookMongoExport.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
    bookMongoExport.ProcessArguments.push('--db=proyecto_final');
    bookMongoExport.ProcessArguments.push('--collection=Libro');
    bookMongoExport.ProcessArguments.push('--type=csv');
    bookMongoExport.ProcessArguments.push('--fields=id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content');
    bookMongoExport.ProcessArguments.push(`--out=${SECURE_FILE_PATH}librosMongoBackup.csv`);
    bookMongoExport.Execute();
    await bookMongoExport.Finish();
    if (bookMongoExport.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${bookMongoExport.ErrorsLog}`);


  /*
    * Tiempo que toma restaurar el respaldo de MongoDB en MsSQL
    * tomar los archivos generados en el paso anterior y restaurarlos en MySQL
    * */

  const authorMongoRestore = new Process(MYSQL_PROCESS);
  authorMongoRestore.ProcessArguments.push(`-u${DB_USER}`);
  authorMongoRestore.ProcessArguments.push(`--password=${DB_PWD}`);
  authorMongoRestore.Execute();
  authorMongoRestore.Write(`
    LOAD DATA INFILE '${SECURE_FILE_PATH}autoresMongoBackup.csv' 
    INTO TABLE proyecto_final.Autor 
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
  `);

  authorMongoRestore.End();
  await authorMongoRestore.Finish();
  if (authorMongoRestore.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${authorMongoRestore.ErrorsLog}`);

  const bookMongoRestore = new Process(MYSQL_PROCESS);
  bookMongoRestore.ProcessArguments.push(`-u${DB_USER}`);
  bookMongoRestore.ProcessArguments.push(`--password=${DB_PWD}`);
  bookMongoRestore.Execute();
  bookMongoRestore.Write(`
    LOAD DATA INFILE '${SECURE_FILE_PATH}librosMongoBackup.csv' 
    INTO TABLE proyecto_final.Libro 
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
  `);
  bookMongoRestore.End();
  await bookMongoRestore.Finish();
  if (bookMongoRestore.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${bookMongoRestore.ErrorsLog}`);

  end = Date.now();
  timers.mysql.backupAndRestoreTime = (end - start) / 1000;
  console.log(`[11] Tiempo total de respaldo y restauración de MongoDB a MySQL: ${(timers.mysql.backupAndRestoreTime)} segundos`);


  /**********************************************************************/
  /*
    * Tiempo total que toma realizar un dump completo de la base de datos de MySQL
    * y luego borrar su contenido (vaciar tablas o eliminar la base de datos)
    * */
  /**********************************************************************/


  start = Date.now();
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
  end = Date.now();
  timers.mysql.fullDumpTime = (end - start) / 1000;
  console.log(`[12] Tiempo total de dump completo de MySQL : ${(timers.mysql.fullDumpTime)} segundos`);


  /**********************************************************************/
  /*
    * Tiempo que toma importar de nuevo
    * el dump completo de MYSQL
    * */
  /**********************************************************************/
  
  start = Date.now();
  const fullDumpImport = new Process(MYSQL_PROCESS);
  fullDumpImport.ProcessArguments.push(`-u${DB_USER}`);
  fullDumpImport.ProcessArguments.push(`--password=${DB_PWD}`);
  fullDumpImport.ProcessArguments.push(`--database=proyecto_final`);
  fullDumpImport.Execute();
  fullDumpImport.Write(`SOURCE ${SECURE_FILE_PATH}fullDump.sql`);
  fullDumpImport.End();
  await fullDumpImport.Finish();
  if (fullDumpImport.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${fullDumpImport.ErrorsLog}`);
  end = Date.now();
  timers.mysql.fullDumpImportTime = (end - start) / 1000;
  console.log(`[13] Tiempo total de importar dump completo de MySQL : ${(timers.mysql.fullDumpImportTime)} segundos`);


  /**********************************************************************/
  /*
    * 
    * Calcular el tiempo cuando el usuario C intenta insertar 
    * en la tabla Autor
    * */
  /**********************************************************************/
    start = Date.now();
    const userCInsert = new Process(MYSQL_PROCESS);
    userCInsert.ProcessArguments.push('-uC');
    userCInsert.ProcessArguments.push('-ptoken1234')
    userCInsert.ProcessArguments.push(`-e`);
    userCInsert.ProcessArguments.push(`
      INSERT INTO proyecto_final.Autor 
      (license, name, lastName, secondLastName, year) 
      VALUES ('UUID()', 'Juan', 'Perez', 'Gomez', 1990);`);

    userCInsert.Execute();
    await userCInsert.Finish();
    end = Date.now();
    timers.mysql.userCInsertTime = (end - start) / 1000;
    console.log(`[14] Tiempo de error de inserccion en tabla Autor: ${(timers.mysql.userCInsertTime)} segundos`);

  /**********************************************************************/
    /*
      * 
      * Calcular el tiempo cuando el usuario C intenta insertar 
      * en la tabla Libro
      * */

  /**********************************************************************/
    start = Date.now();
    const userCInsertBook = new Process(MYSQL_PROCESS);
    userCInsertBook.ProcessArguments.push('-uC');
    userCInsertBook.ProcessArguments.push('-ptoken1234')
    userCInsertBook.ProcessArguments.push(`-e`);
    userCInsertBook.ProcessArguments.push(`
      INSERT INTO proyecto_final.Libro 
      (ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) 
      VALUES ('UUID()', 'El libro de Juan', '123456', 'Editorial', 100, 1990, 'Fantasia', 'Español', 'PDF', 'Sinopsis', 'Contenido');`);
    userCInsertBook.Execute();
    await userCInsertBook.Finish();
    end = Date.now();
    timers.mysql.userCInsertBookTime = (end - start) / 1000;
    console.log(`[15] Tiempo de error de inserccion en tabla Libro: ${(timers.mysql.userCInsertBookTime)} segundos`);

  /**********************************************************************/
  /*
    * Generar 1m de datos para MongoDB
    */
    console.log('Generando 1m de datos para MongoDB......');
  /**********************************************************************/
    // Iniciar contador de tiemo para 1m de datos 
    // Abarca 2 bloques de procesos
    start = Date.now();
    const QUANTITY = 1_000_000;
    const LICENCES_UNIQUE = Randomizer.generateUniqueLicences(QUANTITY);
    await CsvGen.generateBooksCSVDataByThreads(1000000, LICENCES_UNIQUE, 10, FS_PATH + 'mongo1mBooks.csv')

  /**********************************************************************/
  /*
  * Cargar los datos de Libros a MongoDB
  * */
    console.log('Cargando los datos de Libros a MongoDB......');
  /**********************************************************************/
    const mongoLoadData = new Process('mongoimport');
    mongoLoadData.ProcessArguments.push(`--username=${env.MONGO_USER}`);
    mongoLoadData.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
    mongoLoadData.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
    mongoLoadData.ProcessArguments.push('--db=proyecto_final');
    mongoLoadData.ProcessArguments.push('--collection=Libro');
    mongoLoadData.ProcessArguments.push('--type=csv');
    mongoLoadData.ProcessArguments.push(`--file=${FS_PATH}mongo1mBooks.csv`);
    mongoLoadData.ProcessArguments.push('--headerline')
    mongoLoadData.Execute()
    await mongoLoadData.Finish()
    if (mongoLoadData.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${mongoLoadData.ErrorsLog}`);
    // Terminar contador de tiempo para 1m de datos
    end = Date.now();
    timers.mongo.mongoLoadDataTime = (end - start) / 1000;
    console.log(`[16] Tiempo de carga de 1m de datos a MongoDB: ${(timers.mongo.mongoLoadDataTime)} segundos`);


  /**********************************************************************/
  /*
    * Exportar solo los campos ISBN, year y pages 
    * en un solo csv
    * */
    console.log('Exportando solo los fields ISBN, year, pages......');
  /**********************************************************************/
  start = Date.now();
  const mongoExportBookData = new Process('mongoexport');
  mongoExportBookData.ProcessArguments.push(`--username=${env.MONGO_USER}`);
  mongoExportBookData.ProcessArguments.push(`--password=${env.MONGO_PASSWORD}`);
  mongoExportBookData.ProcessArguments.push(`--authenticationDatabase=${env.MONGO_AUTH_DATABASE}`);
  mongoExportBookData.ProcessArguments.push('--db=proyecto_final');
  mongoExportBookData.ProcessArguments.push('--collection=Libro');
  mongoExportBookData.ProcessArguments.push('--type=csv');
  mongoExportBookData.ProcessArguments.push('--fields=ISBN,year,pages');
  mongoExportBookData.ProcessArguments.push(`--out=${FS_PATH}mongo1mBooksExportFields.csv`);
  mongoExportBookData.Execute();
  await mongoExportBookData.Finish();
  if (mongoExportBookData.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${mongoExportBookData.ErrorsLog}`);
  end = Date.now();
  timers.mongo.mongoExportBookDataTime = (end - start) / 1000;
  console.log(`[17] Tiempo en exportar solo los fields ISBN, year, pages: ${(timers.mongo.mongoExportBookDataTime)} segundos`);


  /**********************************************************************/
  /*
    * Crear la tabla old_boooks 
    * */
  /**********************************************************************/
  const createTable = new Process(MYSQL_PROCESS);
  createTable.ProcessArguments.push(`-u${DB_USER}`);
  createTable.ProcessArguments.push(`--password=${DB_PWD}`);
  createTable.Execute();
  createTable.Write(`
      CREATE TABLE proyecto_final.old_books (
          ISBN VARCHAR(255) NOT NULL,
          year VARCHAR(255) NOT NULL,
          pages VARCHAR(255) NOT NULL
      );
  `);
  createTable.End();
  await createTable.Finish();
  if (createTable.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${createTable.ErrorsLog}`);


  /**********************************************************************/
  /*
    * Importar los datos exportados de mongo a 
    * MySQL en la tabla old_boooks
    * */
  /**********************************************************************/

  const mongoImportBookData = new Process(MYSQL_PROCESS);
  mongoImportBookData.ProcessArguments.push(`-u${DB_USER}`);
  mongoImportBookData.ProcessArguments.push(`--password=${DB_PWD}`);
  mongoImportBookData.Execute();
  mongoImportBookData.Write(`
    LOAD DATA INFILE '${FS_PATH}mongo1mBooksExportFields.csv' 
    INTO TABLE proyecto_final.old_books 
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
  `);
  mongoImportBookData.End();
  await mongoImportBookData.Finish();
  if (mongoImportBookData.ErrorsLog && DEBUG_MODE) console.error(`Error during export: ${mongoImportBookData.ErrorsLog}`);
  timers.mongo.mongoImportBookDataTime = (mongoImportBookData.EndTime - mongoImportBookData.StartTime) / 1000;
  console.log(`[18] Tiempo en agreagar los datos a la tabla old_books: ${(timers.mongo.mongoImportBookDataTime)} segundos`);

  /**********************************************************************/
  /*
    * Realizar el reporte enn grafico
    * */
  /**********************************************************************/

  generarReporte(timers)
})()


function generarReporte(metricas) {
    let contenedorHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <title>Métricas de BDD</title>
        </head>
        <body class="bg-gray-100 p-4">
            <h1 class="text-3xl text-center font-bold mb-4">Métricas de BDD</h1>
            <div id="contenedor-graficos" class="grid grid-cols-4 gap-4"></div>
            <script>
                window.onload = function () {
                    const metricas = ${JSON.stringify(metricas)};
                    const contenedor = document.getElementById("contenedor-graficos");

                    function crearGraficoDoughnut(id, label, value) {
                        const canvas = document.getElementById(id);
                        if (!canvas) {
                            console.error("No se encontró el canvas con ID: " + id);
                            return;
                        }

                        const ctx = canvas.getContext("2d");

                        new Chart(ctx, {
                            type: "doughnut",
                            data: {
                                labels: [label, "Restante"],
                                datasets: [{
                                    data: [value, Math.max(0, 250 - value)],
                                    backgroundColor: ["#4CAF50", "#E0E0E0"],
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: true
                            }
                        });
                    }

                    let idContador = 1;
                    Object.keys(metricas).forEach(db => {
                        Object.entries(metricas[db]).forEach(([label, value]) => {
                            const card = document.createElement("div");
                            card.className = "bg-white p-4 shadow rounded-lg flex flex-col items-center";
                            card.innerHTML = \`
                                <h2 class="text-sm font-semibold mb-2">\${label} (\${db})</h2>
                                <canvas id="grafico-\${idContador}" class="w-full max-w-[200px] max-h-[200px]"></canvas>
                                <h2 class="text-sm font-semibold mb-2">\${value} s</h2>
                            \`;
                            contenedor.appendChild(card);

                            crearGraficoDoughnut(\`grafico-\${idContador}\`, label, value);
                            idContador++;
                        });
                    });
                };
            </script>
        </body>
        </html>
    `;

    fs.writeFileSync("reporte.html", contenedorHTML);
    console.log("Reporte generado: reporte.html");
}
