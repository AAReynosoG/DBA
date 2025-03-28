const fs = require('fs');
const Randomizer = require('./randomizer');

class CsvGen {
    static generateAuthorsCSVData(size, uniqueIds, uniqueLicences) {
        let csv = ""

        for (let i = 0; i < size; i++) {
            //const id = uniqueIds[i];
            const licence = uniqueLicences[i];
            const name = Randomizer.randomText(Randomizer.randomNumber(10, 20));
            const lastName = Randomizer.randomText(Randomizer.randomNumber(10, 20));
            const secondLastName = Randomizer.randomText(Randomizer.randomNumber(10, 20));
            const year = Randomizer.randomNumber(1800, 2100);

            csv += `${licence},${name},${lastName},${secondLastName},${year}\n`;
        }

        return csv
    }

    static generateBooksCSVData(size, authorsLicences, uniqueIds, fsPath) {
        let csv = "";

        for (let i = 0; i < size; i++) {
            //const id = uniqueIds[i];
            const isbn = Randomizer.randomText(Randomizer.randomNumber(1, 16))
            const title = Randomizer.randomText(Randomizer.randomNumber(1, 50))
            const autor_license = authorsLicences[Randomizer.randomNumber(0, authorsLicences.length)]
            const editorial = Randomizer.randomText(Randomizer.randomNumber(1, 50))
            const pages = Randomizer.randomNumber(50, 200)
            const year = Randomizer.randomNumber(1900, 2100)
            const genre = Randomizer.randomText(Randomizer.randomNumber(1, 20))
            const language = Randomizer.randomText(Randomizer.randomNumber(1, 20))
            const format = Randomizer.randomText(Randomizer.randomNumber(1, 100))
            const sinopsis = Randomizer.randomText(Randomizer.randomNumber(1, 250))
            const content = Randomizer.randomText(Randomizer.randomNumber(1, 250))

           csv += `${isbn},${title},${autor_license},${editorial},${pages},${year},${genre},${language},${format},${sinopsis},${content}\n`;

        }
        return csv
    }



  static generateBooksCSVDataByThreads(size, authorsLicences, threads = 1, outputFilePath) {
      const chunkSize = Math.ceil(size / threads);
      const writeStream = fs.createWriteStream(outputFilePath);

      const generateChunk = (start, end) => {
          let csv = "";
          for (let i = start; i < end; i++) {
              const isbn = Randomizer.randomText(Randomizer.randomNumber(1, 16));
              const title = Randomizer.randomText(Randomizer.randomNumber(1, 50));
              const autor_license = authorsLicences[Randomizer.randomNumber(0, authorsLicences.length)];
              const editorial = Randomizer.randomText(Randomizer.randomNumber(1, 50));
              const pages = Randomizer.randomNumber(50, 200);
              const year = Randomizer.randomNumber(1900, 2100);
              const genre = Randomizer.randomText(Randomizer.randomNumber(1, 20));
              const language = Randomizer.randomText(Randomizer.randomNumber(1, 20));
              const format = Randomizer.randomText(Randomizer.randomNumber(1, 100));
              const sinopsis = Randomizer.randomText(Randomizer.randomNumber(1, 250));
              const content = Randomizer.randomText(Randomizer.randomNumber(1, 250));

              csv += `${isbn},${title},${autor_license},${editorial},${pages},${year},${genre},${language},${format},${sinopsis},${content}\n`;
          }
          return csv;
      };

      return new Promise((resolve, reject) => {
          let completedThreads = 0;

          for (let t = 0; t < threads; t++) {
              const start = t * chunkSize;
              const end = Math.min(start + chunkSize, size);

              const chunk = generateChunk(start, end);
              writeStream.write(chunk, (err) => {
                  if (err) {
                      reject(err);
                  } else {
                      completedThreads++;
                      if (completedThreads === threads) {
                          writeStream.end();
                          resolve();
                      }
                  }
              });
          }
      });
  }
}

module.exports = CsvGen;
