FROM node:argon

RUN useradd --user-group --create-home --shell /bin/false app &&\
  npm install npm@3.7.5

USER app

RUN git clone https://github.com/vecna/fbtrex.git /home/app/fbtrex &&\
	sed -i 's/localhost/mongo/g' /home/app/fbtrex/config/settings.json &&\
	sed -i 's/127.0.0.1/0.0.0.0/g' /home/app/fbtrex/app.js

WORKDIR /home/app/fbtrex

RUN npm install 
RUN npm run build

EXPOSE 8000

ENTRYPOINT npm run watch
