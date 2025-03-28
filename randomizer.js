class Randomizer {
    static randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    static randomText(nChar) {
        let text = "";
        for (let i = 0; i < nChar; i++) {
            text += String.fromCharCode(Randomizer.randomNumber(65, 91));
        }
        return text;
    }

    static generateUniqueIds(size) {
        console.log("Generando IDs únicos");
        const uniqueIds = new Set();
        while (uniqueIds.size < size) {
            uniqueIds.add(Randomizer.randomNumber(1, 1_000_000));
        }
        console.log("IDs únicos generados");
        return Array.from(uniqueIds);
    }

    static generateUniqueLicences(size) {
        console.log("Generando licencias únicas");
        const uniqueLicences = new Set();
        while (uniqueLicences.size < size) {
            uniqueLicences.add(Randomizer.randomText(Randomizer.randomNumber(1, 12)));
        }
        console.log("Licencias únicas generadas");
        return Array.from(uniqueLicences);
    }
}

module.exports = Randomizer;