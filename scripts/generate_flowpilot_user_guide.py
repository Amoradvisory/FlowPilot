from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    ListFlowable,
    ListItem,
)


OUT_DIR = Path("output/pdf")
PDF_PATH = OUT_DIR / "flowpilot-guide-fr.pdf"


def bullet_list(items, style, left_indent=16):
    return ListFlowable(
        [
            ListItem(Paragraph(item, style), leftIndent=left_indent)
            for item in items
        ],
        bulletType="bullet",
        start="circle",
        leftIndent=left_indent,
    )


def numbered_list(items, style, left_indent=18):
    return ListFlowable(
        [
            ListItem(Paragraph(item, style), leftIndent=left_indent)
            for item in items
        ],
        bulletType="1",
        leftIndent=left_indent,
    )


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=6,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4b5563"),
    )
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#111827"),
        spaceAfter=8,
        alignment=TA_CENTER,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=6,
    )
    h3 = ParagraphStyle(
        "H3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=8,
        spaceAfter=4,
    )
    callout = ParagraphStyle(
        "Callout",
        parent=body,
        backColor=colors.HexColor("#eff6ff"),
        borderColor=colors.HexColor("#93c5fd"),
        borderWidth=0.8,
        borderPadding=8,
        borderRadius=6,
        spaceBefore=8,
        spaceAfter=10,
    )

    story = []
    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph("FlowPilot", h1))
    story.append(Paragraph("Guide d'utilisation complet", ParagraphStyle(
        "Subtitle",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#2563eb"),
        spaceAfter=6,
    )))
    story.append(Paragraph("Version du guide: 27 mars 2026", small))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(
        "Ce document explique comment acceder a l'application, se connecter, l'utiliser au quotidien, "
        "et verifier la synchronisation entre PC et Android.",
        callout,
    ))

    story.append(Paragraph("1. Acces rapide", h2))
    story.append(bullet_list([
        "Application publique: <font color='#2563eb'>https://flow-pilot-sepia.vercel.app</font>",
        "Depot GitHub: <font color='#2563eb'>https://github.com/Amoradvisory/FlowPilot</font>",
        "Compte principal conseille: <b>monagenda.be@gmail.com</b>",
        "Plateformes: PC et Android",
    ], body))

    story.append(Paragraph("2. A quoi sert FlowPilot", h2))
    story.append(Paragraph(
        "FlowPilot est un cockpit personnel de productivite. Son cycle principal est le suivant: "
        "Inbox, Clarifier, Planifier, Executer avec Focus, puis Revoir.",
        body,
    ))
    story.append(bullet_list([
        "Capture rapide dans l'Inbox",
        "Clarification des elements un par un",
        "Planification dans les taches et l'agenda",
        "Execution avec timer Focus",
        "Revue de fin de journee ou de semaine",
    ], body))
    story.append(Paragraph(
        "L'application fonctionne en mode local-first: les actions sont enregistrees d'abord localement, "
        "puis synchronisees quand le reseau est disponible.",
        body,
    ))

    story.append(Paragraph("3. Premiere connexion", h2))
    story.append(Paragraph("Methode recommandee", h3))
    story.append(numbered_list([
        "Ouvrir l'URL publique de FlowPilot.",
        "Cliquer sur <b>Continuer avec Google</b>.",
        "Choisir le compte <b>monagenda.be@gmail.com</b>.",
        "Accepter l'autorisation Google.",
        "Attendre la redirection vers le dashboard.",
    ], body))
    story.append(Paragraph(
        "Important: la connexion Google a ete testee avec ce compte principal. "
        "Si un autre compte doit etre utilise plus tard, il faudra peut-etre l'ajouter comme utilisateur de test.",
        callout,
    ))

    story.append(Paragraph("4. Installation sur Android", h2))
    story.append(numbered_list([
        "Ouvrir l'application dans Chrome sur Android.",
        "Ouvrir le menu du navigateur.",
        "Choisir <b>Ajouter a l'ecran d'accueil</b>.",
        "Lancer ensuite FlowPilot comme une application.",
    ], body))

    story.append(Paragraph("5. Ecrans principaux", h2))
    for title, text in [
        ("Dashboard", "Vue d'ensemble du moment, des taches du jour, du focus, des habitudes et de l'inbox."),
        ("Inbox", "Capture rapide d'idees, taches, rappels et notes a clarifier plus tard."),
        ("Clarifier", "Traitement d'un element Inbox a la fois en tache, projet, note ou suppression."),
        ("Taches", "Organisation, priorisation, planification et execution des taches."),
        ("Agenda", "Vision jour/semaine avec creneaux et planification."),
        ("Focus", "Timer lie a une tache pour enregistrer le temps reel de travail."),
        ("Projets", "Regroupement de taches et notes autour d'un sujet."),
        ("Habitudes", "Suivi quotidien avec completions et streaks."),
        ("Revue", "Nettoyage de l'inbox, revue des retards et preparation de la suite."),
    ]:
        story.append(Paragraph(title, h3))
        story.append(Paragraph(text, body))

    story.append(PageBreak())

    story.append(Paragraph("6. Routine conseillee", h2))
    story.append(Paragraph("Le matin", h3))
    story.append(numbered_list([
        "Ouvrir le Dashboard.",
        "Regarder la tache la plus importante.",
        "Planifier 1 a 3 taches claires.",
        "Lancer une premiere session Focus.",
    ], body))
    story.append(Paragraph("Dans la journee", h3))
    story.append(numbered_list([
        "Capturer chaque idee dans l'Inbox.",
        "Clarifier pendant un moment calme.",
        "Utiliser Focus pour les blocs de travail.",
    ], body))
    story.append(Paragraph("Le soir", h3))
    story.append(numbered_list([
        "Marquer ce qui est termine.",
        "Replanifier ce qui reste.",
        "Vider les urgences de l'Inbox.",
    ], body))

    story.append(Paragraph("7. Synchronisation entre PC et Android", h2))
    story.append(Paragraph(
        "La synchronisation fonctionne si le meme compte est utilise sur les deux appareils et "
        "si chaque appareil a acces au reseau au moins de temps en temps.",
        body,
    ))
    story.append(numbered_list([
        "Se connecter sur le PC.",
        "Se connecter sur Android avec le meme compte.",
        "Ajouter une tache sur un appareil.",
        "Attendre quelques secondes.",
        "Verifier qu'elle apparait sur l'autre.",
    ], body))
    story.append(Paragraph(
        "Mode hors ligne: l'application peut continuer a enregistrer localement. "
        "Quand internet revient, la synchronisation doit repartir.",
        callout,
    ))
    story.append(Paragraph(
        "Le systeme de synchronisation utilise un champ de version pour gerer les conflits "
        "et eviter la perte silencieuse de donnees.",
        body,
    ))

    story.append(Paragraph("8. Test simple a faire maintenant", h2))
    story.append(numbered_list([
        "Ouvrir l'app sur le PC.",
        "Ouvrir l'app sur Android.",
        "Se connecter avec le meme compte sur les deux.",
        "Ajouter <b>Test sync PC</b> sur le PC.",
        "Verifier son arrivee sur Android.",
        "Ajouter <b>Test sync Android</b> sur Android.",
        "Verifier son arrivee sur le PC.",
    ], body))

    story.append(Paragraph("9. Depannage rapide", h2))
    story.append(Paragraph("Le bouton Google ne marche pas", h3))
    story.append(bullet_list([
        "Verifier que l'on est sur l'URL publique.",
        "Recharger la page.",
        "Reessayer avec Continuer avec Google.",
    ], body))
    story.append(Paragraph("Une tache n'apparait pas sur l'autre appareil", h3))
    story.append(bullet_list([
        "Verifier que le meme compte est utilise.",
        "Attendre quelques secondes.",
        "Appuyer sur Sync.",
        "Verifier que le reseau est actif.",
    ], body))
    story.append(Paragraph("Android ne propose pas l'installation", h3))
    story.append(bullet_list([
        "Ouvrir dans Chrome.",
        "Utiliser le menu Chrome.",
        "Choisir Ajouter a l'ecran d'accueil.",
    ], body))

    story.append(Paragraph("10. Contexte technique resume", h2))
    story.append(bullet_list([
        "Frontend: SvelteKit + TypeScript + Tailwind",
        "Base locale: Dexie / IndexedDB",
        "Backend: Supabase",
        "Auth: email/mot de passe + Google",
        "Sync: Supabase + file locale",
        "Deploiement: Vercel",
        "PWA: oui",
    ], body))

    story.append(PageBreak())

    story.append(Paragraph("11. Contexte pour un autre assistant", h2))
    story.append(Paragraph(
        "Si ce PDF est donne a un autre modele de langage, voici le contexte utile pour expliquer "
        "ou reprendre l'application rapidement.",
        body,
    ))
    story.append(bullet_list([
        "Nom du produit: FlowPilot",
        "URL publique: https://flow-pilot-sepia.vercel.app",
        "Repository: https://github.com/Amoradvisory/FlowPilot",
        "Compte Google principal de test: monagenda.be@gmail.com",
        "Application mono-utilisateur, locale d'abord, synchronisee ensuite",
        "Cycle coeur: Inbox -> Clarifier -> Taches -> Focus -> Revue",
        "Objectif principal: usage quotidien sur PC et Android avec synchronisation",
    ], body))

    story.append(Paragraph("12. Resume ultra court", h2))
    story.append(numbered_list([
        "Ouvrir l'URL publique.",
        "Se connecter avec Google.",
        "Ajouter l'app a l'ecran d'accueil sur Android.",
        "Capturer dans l'Inbox.",
        "Clarifier.",
        "Executer avec Focus.",
        "Verifier la synchronisation entre PC et telephone.",
    ], body))

    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="FlowPilot - Guide d'utilisation",
        author="Codex",
    )
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(PDF_PATH)


if __name__ == "__main__":
    build()
