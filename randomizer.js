const crypto = require('crypto');

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

    static generateUniqueLicenceB64(){
        return crypto.randomBytes(6).toString('base64url').substring(0, 12);
    }

    static generateUniqueId(currentIdsSet){
        let id;
        do {
            id = Randomizer.randomNumber(1, 1_000_050);
        }while(currentIdsSet.has(id));
        currentIdsSet.add(id);
        return id;
    }

    static generateUniqueIds(size) {
        const uniqueIds = new Set();
        while (uniqueIds.size < size) {
            uniqueIds.add(Randomizer.randomNumber(1, 1_000_050));
        }
        return Array.from(uniqueIds);
    }

    static generateUniqueLicences(size) {
        const uniqueLicences = new Set();
        while (uniqueLicences.size < size) {
            //uniqueLicences.add(Randomizer.randomText(Randomizer.randomNumber(1, 12)));
            uniqueLicences.add(Randomizer.generateUniqueLicenceB64());
        }
        return Array.from(uniqueLicences);
    }
}

module.exports = Randomizer;
