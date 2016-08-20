import fs from 'fs';


export function loadFixture(name) {
    return fs.readFileSync('./test/fixtures/' + name + '.html').toString();
}
