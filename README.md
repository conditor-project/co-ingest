[![Build Status](https://travis-ci.org/conditor-project/co-ingest.svg?branch=master)](https://travis-ci.org/conditor-project/co-ingest)

co-ingest
===============

## Présentation ##

Le module **co-ingest** est un module général de récolte de données.

### Fonctionnement ###

Le module co-ingest est un module d'entrée de chaîne. Il est donc voué à être un module de génération de flux, et non un module de gestion de flux. 
Sa logique diffère en cela de la majorité des autres modules héritant tous du comportement de li-module. 
Le module co-ingest va prendre un Json de configuration en entrée et gérer la génération du flux en fonction des paramètres transmis. 
En mode ZIP : Le module décompresse l'archive en en extrayant uniquement les fichiers xml.
              Il va ensuite générer un fichier json contenant un maximum de 100 entrées pour le pousser vers le flux de gestion


## Utilisation ##

### Installation ###

Dépendances système :
  * NodeJS 4.0.0+

Commande d'Installation :
```bash
npm install
```

### Vérification du fonctionnement ###
Commande d'exécution des tests unitaires :
```bash
npm test
```

### Exécution ###

Comme pour tous les modules, la présente partie métier n'est pas destinée à être exécutée directement, puisqu'elle consiste uniquement à mettre à disposition une fonction doTheJob.

L'exécution se fera donc en appelant cette fonction depuis une instanciation de li-canvas ou indirectement depuis les tests unitaires.


## Annexes ##

### Arborescence ###

```
.
├── index.js                        // Point d'entrée, contenant la fonction doTheJob()
├── node_modules                    // Modules NPM
│   ├── ...
├── package.json                    // No comment
├── README.md
└── test                            // Fichiers nécessaires aux TU
    ├── dataset                     // rép de données de tests
    │   └── zip
    |       └ in
    |         └── input.zip         // contient une archive contenant des notices xml
    ├── run.js                      // servant pour les TU
    └──

### Codes d'erreur ###

