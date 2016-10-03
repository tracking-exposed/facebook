import fs from 'fs';
import cheerio from 'cheerio';

export function $ (html) {
    return { find: cheerio.load(html) };
}

export function loadFixture (name) {
    return $(fs.readFileSync('./test/fixtures/' + name + '.html').toString());
}

export class TimeWarp {
    set () {
        const args = Array.prototype.slice.call(arguments, 0, 6);
        const offset = arguments[6] || 0;

        if (!this._Date) {
            this._Date = global.Date;
        }

        global.Date = () => {
            // Thanks to http://stackoverflow.com/a/8843181/597097
            const date = new (Function.prototype.bind.call(this._Date, null, ...args));
            date.getTimezoneOffset = () => offset;
            return date;
        };

        global.Date.now = () => new Date();
    }

    reset () {
        if (this._Date) {
            global.Date = this._Date;
        }
    }
}
