import fs from 'fs';
import $ from 'cheerio';
import glob from 'glob';

const FIXTURE_DIR = './test/fixtures/';

export function loadFixture (name) {
    return $(fs.readFileSync(FIXTURE_DIR + name + '.html').toString());
}

export function loadPayload (name) {
    return JSON.parse(fs.readFileSync('./test/payloads/' + name + '.json'));
}

export function listFixtures (path) {
    return glob.sync(FIXTURE_DIR + path + '/**/*.html')
               .map((path) => path.slice(FIXTURE_DIR.length).replace(/\.[^/.]+$/, ''));
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
