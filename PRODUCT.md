# Product

## Register

product

## Users

Deux publics, deux espaces :

- **Organisations clientes** (espace `/`, app connectée) : centres d'appels en France / Suisse. Administrateur (décideur), agent calliste (enchaîne les appels), agent RDV (tient l'agenda). Usage quotidien, long, au bureau, souvent avec un casque, souvent sur un écran partagé entre plusieurs onglets.
- **Super Administrateur** (console `/platform`) : l'éditeur de CLIENTIA, quelques personnes. Visite courte et ciblée : créer une organisation et inviter son administrateur, suspendre ou réactiver, retrouver une organisation, contrôler une suppression. Le tableau de bord est secondaire.

## Product Purpose

CRM de prospection téléphonique et de prise de rendez-vous, multi-organisation : appels, dossiers clients, calendrier partagé et e-mails dans un seul outil. Chaque organisation a son espace isolé ; l'accès se fait sur invitation. La console plateforme sert à administrer ces organisations sans jamais toucher à leurs données métier. Succès : un agent ne perd aucun rappel, un administrateur contrôle ses équipes, le Super Admin agit vite et sans erreur irréversible.

## Brand Personality

Fiable, précis, calme. Un outil de travail sérieux qui ne crie pas : français soigné, libellés explicites, aucune emphase gratuite. La console plateforme est de la même famille que l'app (même palette, même typographie) mais plus sobre et plus dense : ton d'opérateur, actions sensibles signalées sans dramatiser.

## Anti-references

- Le « SaaS générique » : grilles de cartes identiques (icône + titre + texte), gros chiffres de tableau de bord façon template avec dégradé, hero-metrics.
- Eyebrows en petites capitales espacées au-dessus de chaque section, numérotation décorative 01 / 02 / 03.
- Glassmorphism, texte en dégradé, bordures latérales colorées sur les cartes.
- Consoles d'admin « bootstrap » grises et sans hiérarchie.

## Design Principles

1. **L'action avant le décor** : sur chaque écran, la tâche principale est visible et atteignable en un geste ; le reste se tait.
2. **Rien d'irréversible par surprise** : les actions destructrices sont nommées, expliquées, confirmées et réversibles quand c'est possible (suppression douce, suspension avant suppression).
3. **L'état se lit sans effort** : statut, nombre, date, propriétaire sont toujours visibles au même endroit, avec la même forme.
4. **Même famille, registre différent** : la console reconnaît CLIENTIA mais se distingue de l'espace client par la densité et la sobriété, jamais par une autre identité.
5. **Dire vrai** : libellés exacts, messages d'erreur utiles, aucune promesse que le produit ne tient pas.

## Accessibility & Inclusion

WCAG 2.1 AA : contraste ≥ 4.5:1 pour le texte courant, navigation clavier complète avec focus visible, libellés accessibles sur les commandes sans texte, `prefers-reduced-motion` respecté, information jamais portée par la seule couleur. Interface uniquement en français.
