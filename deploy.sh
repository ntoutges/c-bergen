#!/bin/bash

time (
    echo "Installing all dependencies"
    npm i

    echo "Building site"
    vite build

    echo "Deploying site"
    firebase deploy

    echo "Site successfully deployed"
)
