[![Build Status](https://travis-ci.org/conditor-project/co-ingest.svg?branch=master)](https://travis-ci.org/conditor-project/co-ingest)

co-ingest
===============

## Présentation ##

Le module **co-ingest** est un module général de récolte de données.

### Fonctionnement ###

Le module `co-ingest` est un module d'entrée de chaîne. Il est donc voué à être un module de génération de flux, et non un module de "gestion". Il n'effectue aucun traitement sur les documents eux-même.

Ainsi, contrairement autres modules héritant du comportement de `li-module`, il ne traite pas autant de documents en entrée (in) qu'en sortie (out + err), mais :
  - il prend en entrée un fichier JSON "bootstrap" dont le but est d'initialiser la chaîne
  - il génère autant de "docObjects" que de notices trouvées.

#### Structure d'entrée

Le fichier JSON d'entrée possède la structure minimale suivante :

```
{
    "source" : "name_of_the_source",           // must be the same for documents coming for the same provider 
    "ingest": {                                
        "type": "type_of_input",               // only zip supported for today, could be "oai-pmh", "ftp", "api-harvesting", etc....
        "sessionName": "name_of_session"       // a string identifying the processing session
        ....                                   // other fields depending of the type of ingestion (examples : Path of a ZIP file, URL of an API, settings of a FTP server, etc) 
    },
    "corpusRoot": "path_to_unzip_destination"  // root of the set of docs => absolute path of where the notices will be extracted
}
```

#### Structure de sortie

En sortie, les JSON produits reprennent l'ensemble des champs d'entrée, plus des champs spécifiques à chaque notice/document identifié :

```
{
    ....
    "id": document_id,                // auto-attributed identifier
    "path": "path_to_document.xml"    // absolute path of the document (XML or other format)
}

```


#### ingestions de type ZIP ####

En mode Zip, `co-ingest` prend en entrée une archive ZIP, l'extrait et tente d'identifier les notices XML contenues.

Les traitements effectués sont : 
- la décompression de l'archive en extrayant uniquement les fichiers dont l'extension est "xml".
- la génération de fichiers JSON contenant un maximum de 100 entrées, chacune pointant sur l'un des fichiers XML extraits 

Un seul champ du JSON d'entrée (`ingest.path`) est spécifique à ce type d'ingestion :


```
{
    "source" : ... 
    "ingest": {
        "path": "path_to_input.zip",   // absolute path of the input zip containing XML notices  
        ....
    },
    "corpusRoot": ...
}
```


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

```