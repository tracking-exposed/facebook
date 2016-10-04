FROM node:argon

RUN useradd --user-group --create-home --shell /bin/false app &&\
  npm install --global npm@3.7.5

USER app

RUN git clone https://github.com/vecna/fbtrex.git /home/app/fbtrex &&\
	sed -i 's/localhost/mongo/g' /home/app/fbtrex/config/settings.json

WORKDIR /home/app/fbtrex

RUN npm install express && npm install
RUN npm run build

EXPOSE 8000
