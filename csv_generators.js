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
            const year = Randomizer.randomNumber(1850, 2000);

            csv += `${licence},${name},${lastName},${secondLastName},${year}\n`;
        }

        return csv
    }

    static generateBooksCSVData(size, authorsLicences, uniqueIds, fsPath) {
        let csv = "";

        for (let i = 0; i < size; i++) {
            //const id = uniqueIds[i];
            const ibsn = Randomizer.randomText(Randomizer.randomNumber(1, 16))
            const title = Randomizer.randomText(Randomizer.randomNumber(1, 50))
            const autor_license = authorsLicences[Randomizer.randomNumber(0, authorsLicences.length)]
            const editorial = Randomizer.randomText(Randomizer.randomNumber(1, 50))
            const pages = Randomizer.randomNumber(50, 200)
            const year = Randomizer.randomNumber(1900, 2021)
            const genre = Randomizer.randomText(Randomizer.randomNumber(1, 20))
            const language = Randomizer.randomText(Randomizer.randomNumber(1, 20))
            const format = Randomizer.randomText(Randomizer.randomNumber(1, 100))
            const sinopsis = Randomizer.randomText(Randomizer.randomNumber(1, 250))
            const content = Randomizer.randomText(Randomizer.randomNumber(1, 250))

            csv += `${ibsn},${title},${autor_license},${editorial},${pages},${year},${genre},${language},${format},${sinopsis},${content}\n`;
        }

        return csv;
    }
}

module.exports = CsvGen;