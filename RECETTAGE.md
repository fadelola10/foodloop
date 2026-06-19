# Recettage FoodLoop

## Contexte

Les vérifications ont été réalisées au fur et à mesure du développement de l'application afin de valider les principaux parcours utilisateur.

Configuration utilisée :
- Navigateur principal : Chrome
- Vérification mobile : Safari iPhone
- 1 compte client
- 1 compte producteur

---

## Authentification

### Connexion client
- Connexion effectuée avec succès.
- Redirection vers l'espace utilisateur vérifiée.

### Connexion producteur
- Connexion effectuée avec succès.
- Accès au tableau de bord producteur vérifié.

### Contrôle des accès
- Un compte client ne peut pas accéder aux pages réservées aux producteurs.
- Redirection correcte observée lors des essais.

---

## Catalogue

### Affichage des produits
Vérifié que seuls les produits actifs apparaissent dans le catalogue.

### Filtres
Tests réalisés sur plusieurs catégories :
- Fruits et légumes
- Produits laitiers
- Épicerie

Le filtrage fonctionne correctement et met à jour la liste affichée.

### Fiche produit
Points contrôlés :
- nom du produit ;
- prix ;
- unité ;
- image ;
- labels associés.

---

## Panier

### Ajout de produits
- Ajout d'un premier produit : OK.
- Ajout du même produit plusieurs fois : la quantité est bien mise à jour.

### Modification des quantités
- Incrémentation : OK.
- Diminution : OK.
- Suppression automatique lorsque la quantité atteint 0 : OK.

### Total du panier
Le montant affiché correspond aux produits présents dans le panier lors des tests effectués.

---

## Commandes

### Passage de commande
Parcours complet testé :
1. ajout de produits ;
2. validation du panier ;
3. création de la commande.

Résultat : commande enregistrée correctement.

### Suivi côté client
La commande apparaît dans l'historique après validation.

### Suivi côté producteur
La commande est visible dans la liste des commandes reçues.

### Changement de statut
Testé avec plusieurs statuts.
Les modifications sont bien répercutées après actualisation.

---

## Gestion des produits (producteur)

### Création
Création de plusieurs produits de test avec image et catégorie.

### Modification
Mise à jour du prix et du stock vérifiée.

### Suppression
Suppression testee avec la confirmation utilisateur.

### Labels
Association et modification des label validés.

---

## Remarque rencontrées pendant les tests

- Quelques ajustement ont été nécessaires sur le panier pendant le développement.
- Vérification supplémentaire effectuée sur les calculs de total après modification des quantités.
- Les tests ont principalement porté sur les fonctionnalités essentielles du MVP.

---

## Validation finale

Les principaux parcours suivants ont été validés :

- authentification ;
- consultation du catalogue ;
- gestion du panier ;
- création de commande ;
- suivi des commandes ;
- gestion des produits par un producteur.

Aucune anomalie bloquante n'a été constatée lors de la validation finale.

