FROM node:argon

RUN useradd --user-group --create-home --shell /bin/false app &&\
  npm install npm@3.7.5

USER app
COPY --chown=app:app . /home/app/fbtrex
RUN     sed -i 's/localhost:9200/elastic:9200/g' /home/app/fbtrex/config/settings.json
RUN	sed -i 's/localhost/mongo/g' /home/app/fbtrex/config/settings.json 
RUN	sed -i 's/127.0.0.1/0.0.0.0/g' /home/app/fbtrex/app.js

WORKDIR /home/app/fbtrex

RUN npm install 
RUN npm run build
ENV DOCKER="true"

EXPOSE 8000

ENTRYPOINT npm run watch
