const Randomizer = require('./randomizer');
const Process = require('./utils/Process');

class Stresser {

    static async mysqlStresser(threads, reps, authorsLicences, dbUser, dbPwd) {
        let count = threads;
        return new Promise(async (resolve, reject) => {
            for(let p = 0; p < threads; p++) {
                (async () => {
                    const mysql = new Process("mysql", {
                        shell: true
                    });
                    mysql.ProcessArguments.push(`-u${dbUser}`);
                    mysql.ProcessArguments.push(`--password=${dbPwd}`);
                    mysql.Execute();
                    mysql.Write("use proyecto_final;");
                    mysql.Write('\n');

                    for(let i = 0; i < reps; i++) {
                        //const id = Randomizer.generateUniqueId(currentIdsSet);
                        const isbn = Randomizer.randomText(Randomizer.randomNumber(1, 16))
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

                        await mysql.Write(`INSERT INTO Libro (id, isbn, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content) VALUES (UUID_SHORT() % 4294967295, '${isbn}', '${title}', '${autor_license}', '${editorial}', '${pages}', '${year}', '${genre}', '${language}', '${format}', '${sinopsis}', '${content}');`);
                        await mysql.Write('\n');
                        //currentIdsSet.add(id);
                    }

                    await mysql.End();
                    await mysql.Finish();
                    if (mysql.ErrorsLog) console.log(`Error during export: ${mysql.ErrorsLog}`);
                    count--;
                    if(count === 0) {
                        resolve(true);
                    }
                })();
            }
        });
    }
}

module.exports = Stresser;