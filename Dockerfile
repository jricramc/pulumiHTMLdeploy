# Use Node.js base image
FROM node:18

# Install Pulumi CLI
RUN curl -fsSL https://get.pulumi.com | sh
# Add Pulumi to PATH
ENV PATH="/root/.pulumi/bin:${PATH}"

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

EXPOSE 3005
CMD [ "node", "app.js" ]
