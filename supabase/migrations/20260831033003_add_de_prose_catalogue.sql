-- The German catalogue: every published English string gets a `de` twin — issue #53.
--
-- ---------------------------------------------------------------------------------------
-- 282 ROWS, NOT THE 279 THE TICKET SAYS
-- ---------------------------------------------------------------------------------------
--
-- #53 was written before #110 landed. It counts the 279 rows the English backfill inserted
-- and predates the three `Center` rows — ageRange, hoursShort, neighborhood — that #110 moved
-- out of `site_settings` on 2026-08-30. Those three are in this migration and are the ones the
-- ticket's own "three site-settings strings" section is about: they are interpolated INTO other
-- prose, so a missing German `Center.ageRange` does not leave a gap at the edge of a page, it
-- puts an English clause inside a German sentence.
--
-- The count was taken from the database rather than from the ticket:
--
--     select count(*) from prose p join orgs o on o.id = p.org_id
--      where o.slug = 'willow-grove' and p.locale = 'en' and p.status = 'published';
--     282
--
-- ---------------------------------------------------------------------------------------
-- MACHINE TRANSLATION, DELIBERATELY
-- ---------------------------------------------------------------------------------------
--
-- #53 required a native German reviewer until 2026-08-22, when that was superseded: this is a
-- practice project with a fictional center and no real users, so a mistranslated ratio costs
-- nobody's trust. The superseded requirement is recorded on the ticket rather than deleted.
--
-- What was NOT relaxed, because it is mechanical rather than a matter of fluency:
--
--   * **Every ICU placeholder is preserved exactly** — {years} {count} {ageRange} {since}
--     {lowest} {amount} {weeks} {percent} {address} {neighborhood} {licenseNumber}. next-intl
--     throws on a message missing one and that now fails the build, so a dropped brace is a red
--     deploy rather than a typo. They are asserted per row by the parity test, not eyeballed.
--   * **Proper nouns are not translated** — Willow Grove, Wallace Park, Northwest Portland, and
--     every staff first name stay as they are. They name real-in-fiction things, and a
--     "Weidenhain" would be a different center.
--   * **German quotation marks** in the two strings that carry quotes. „…“ is not decoration
--     here: the English rows use curly “…”, and leaving them would look like an untranslated
--     string rather than a stylistic choice.
--
-- ---------------------------------------------------------------------------------------
-- WHY status = 'published' AND NOT 'draft'
-- ---------------------------------------------------------------------------------------
--
-- Same reason the English backfill gives. `getProse` reads published rows only and raises when
-- a locale returns none, so landing these as drafts would mean the first build after `de` joins
-- `routing.locales` fails on an empty catalogue, and someone would have to press Publish to
-- release copy that was never unpublished.
--
-- It is also the honest status. These rows are not an edit awaiting review — they are the
-- initial content of a locale that no visitor can reach yet, because `routing.locales` is the
-- gate and it is a separate line in a separate file.
--
-- ---------------------------------------------------------------------------------------
-- SAFE TO RUN TWICE
-- ---------------------------------------------------------------------------------------
--
-- The upsert targets `prose_one_published_per_key` through the `on conflict (cols) where
-- predicate` form — #93 is why the predicate is spelled out: `on conflict (cols)` alone cannot
-- choose between the table's two partial indexes and Postgres refuses to plan the statement.
--
-- A second run updates the same published rows in place and does NOT touch drafts, so a staff
-- member's unpublished German edit survives it. It never deletes.

insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, 'de', v.namespace, v.key, v.value, 'published'
from public.orgs o
cross join (values
  -- The three strings other strings interpolate (#110). First, because a German page breaks
  -- mid-sentence without them rather than merely showing English.
  ('Center', 'ageRange', '6 Wochen bis 5 Jahre'),
  ('Center', 'hoursShort', 'Mo–Fr, 7:00–18:00 Uhr'),
  ('Center', 'neighborhood', 'Northwest Portland, einen Block vom Wallace Park'),

  -- Navigation. Held deliberately short: #53 requires the nav to survive 360px in German, and
  -- "Betreuungsgebühren" in a seven-item bar is where that fails first.
  ('Nav', 'home', 'Willow Grove Startseite'),
  ('Nav', 'programs', 'Programme'),
  ('Nav', 'about', 'Über uns'),
  ('Nav', 'staff', 'Team'),
  ('Nav', 'tuition', 'Gebühren'),
  ('Nav', 'faq', 'FAQ'),
  ('Nav', 'contact', 'Kontakt'),

  ('Programs', 'infants', 'Säuglinge'),
  ('Programs', 'toddlers', 'Kleinkinder'),
  ('Programs', 'preschool', 'Vorschule'),

  ('Staff', 'tenure', 'seit {years} Jahren bei Willow Grove'),
  ('Staff', 'mariaRole', 'Leiterin'),
  ('Staff', 'mariaBio', 'Führt das Haus und übernimmt immer noch die Säuglingsgruppe, wenn jemand krank ist. Sie ist die Person, zu der Sie durchgestellt werden, wenn Sie anrufen, und die Ihnen offen sagt, wenn für die gewünschte Gruppe neun Monate Wartezeit bestehen.'),
  ('Staff', 'nadiaRole', 'Stellvertretende Leiterin'),
  ('Staff', 'nadiaBio', 'Kümmert sich um Anmeldungen, die Warteliste und jedes Formular, das die Behörde verlangt. Wenn Ihnen anderswo je eine vage Auskunft über Gebühren gegeben wurde, ist sie die Korrektur dazu.'),
  ('Staff', 'aishaRole', 'Leitung Säuglingsgruppe'),
  ('Staff', 'aishaBio', 'Acht Jahre in der Säuglingsgruppe, und noch nie hat sie Eltern ein Tagesblatt in die Hand gedrückt, bei dem sie raten musste. Sie ist der Grund, warum wir Ihnen sagen können, auf welcher Seite Ihre Tochter lieber gehalten wird.'),
  ('Staff', 'graceRole', 'Erzieherin Säuglingsgruppe'),
  ('Staff', 'graceBio', 'Kam von einer Neugeborenenstation im Krankenhaus zu uns, was man daran merkt, wie sie mit einem Baby umgeht, das nicht zur Ruhe kommt. Sie hat die ruhigsten Hände im Haus, und der Raum ist dadurch leiser.'),
  ('Staff', 'danielRole', 'Leitung Kleinkindgruppe'),
  ('Staff', 'danielBio', 'Verbringt seinen Tag damit, die Welt Menschen zu erklären, die gerade entdeckt haben, dass sie Wörter hat. Das Sauberwerden geschieht bei ihm, im Tempo Ihres Kindes, und er wird Ihnen nie das Gefühl geben, im Rückstand zu sein.'),
  ('Staff', 'tomRole', 'Leitung Vorschulgruppe'),
  ('Staff', 'tomBio', 'Leitet jeden Morgen die Kleingruppenarbeit und schreibt im Frühjahr an die Grundschule jedes Kindes, damit die erste Lehrkraft es schon kennt. Sechs Jahre in derselben Gruppe.'),
  ('Staff', 'sofiaRole', 'Köchin'),
  ('Staff', 'sofiaBio', 'Kocht jede Mahlzeit im Haus, weshalb wir bei Allergien genau sein können statt nur hoffnungsvoll. Sie weiß, welche Kinder Gemüse nur essen, wenn es auf eine bestimmte Art geschnitten ist, und schneidet es genau so.'),

  ('StaffPage', 'metaTitle', 'Team'),
  ('StaffPage', 'metaDescription', 'Die Erzieherinnen, Erzieher und Mitarbeitenden einer lizenzierten Kindertagesstätte in Northwest Portland — wer sie sind, wie lange sie schon hier sind und warum das die Zahl zum Vergleichen ist.'),
  ('StaffPage', 'eyebrow', '{count} Personen im Team'),
  ('StaffPage', 'heading', 'Die Menschen, die Ihr Kind kennen werden'),
  ('StaffPage', 'intro', 'Die Führung erzählt Ihnen etwas über das Gebäude. Diese Seite erzählt Ihnen etwas über die Menschen darin, denn ein Raum ist nur so verlässlich wie die Person, die darin steht — und wie lange sie geblieben ist, kann keine Broschüre erfinden.'),
  ('StaffPage', 'factTeamLabel', 'Personen im Team'),
  ('StaffPage', 'factTenureLabel', 'Durchschnittlich bei uns'),
  ('StaffPage', 'factLongestLabel', 'Am längsten bei uns'),
  ('StaffPage', 'factChecksLabel', 'Jede Einstellung'),
  ('StaffPage', 'factChecksValue', 'Führungszeugnis geprüft, Erste Hilfe und Reanimation aktuell'),
  ('StaffPage', 'yearsValue', '{years} Jahre'),
  ('StaffPage', 'teamHeading', 'Wer hier ist'),
  ('StaffPage', 'teamBody', 'Porträts folgen; die Initialen sind ein Platzhalter, kein Stockfoto vom Personal einer anderen Einrichtung. Alles unter jedem Namen trifft auf die Person zu, die tatsächlich im Raum stehen wird.'),
  ('StaffPage', 'stayHeading', 'Warum Menschen bleiben'),
  ('StaffPage', 'stayBody', 'Personalwechsel ruiniert eine Einrichtung leise, und auf einer Website wird er fast nie erwähnt. Hier steht, was wir dagegen tun, damit Sie der nächsten Einrichtung dieselben drei Fragen stellen können.'),
  ('StaffPage', 'stayPayTitle', 'Bewusst über dem üblichen Satz bezahlt'),
  ('StaffPage', 'stayPayBody', 'Unsere Fachkräfte verdienen mehr als in den Einrichtungen um uns herum, und die Bezahlung steigt mit der Zeit hier statt mit einem Titel. Das ist der größte Posten auf unserer Kostenaufstellung und der Grund, warum die Gebühren sind, wie sie sind.'),
  ('StaffPage', 'stayRoomTitle', 'Dieselbe Gruppe, das ganze Jahr'),
  ('StaffPage', 'stayRoomBody', 'Niemand wird zwischen Gruppen verschoben, um eine Lücke zu stopfen. Eine Fachkraft bleibt das Jahr über bei ihrer Gruppe, und erst das macht aus einer festen Bezugsperson mehr als ein Wort auf dem Papier.'),
  ('StaffPage', 'stayHiringTitle', 'Absichtlich langsam bei Einstellungen'),
  ('StaffPage', 'stayHiringBody', 'Eine offene Stelle wird von der Leitung und der stellvertretenden Leitung abgedeckt, statt schnell besetzt zu werden. Bei jeder Einstellung liegt vor dem ersten Tag mit Kindern ein Führungszeugnis vor, ohne Ausnahmen für volle Wochen.'),
  ('StaffPage', 'visitHeading', 'Kommen Sie vorbei und lernen Sie sie kennen'),
  ('StaffPage', 'visitBody', 'Namen auf einer Seite nützen wenig. Kommen Sie vorbei, schauen Sie sich die Gruppe an, in der Ihr Kind wäre, und sehen Sie, ob die Person darin jemand ist, bei dem Ihr Kind zur Ruhe käme.'),

  -- Timeline labels. These sit in narrow cards on the day rhythm; #53 names them as a 360px
  -- risk, so each is kept to something that wraps to two lines at most.
  ('Day', 'arrival', 'Ankommen und Freispiel'),
  ('Day', 'breakfast', 'Frühstück, dann Morgenkreis'),
  ('Day', 'centers', 'Lernbereiche und Zeit im Freien'),
  ('Day', 'lunch', 'Mittagessen aus eigener Küche'),
  ('Day', 'nap', 'Mittagsschlaf und Ruhezeit'),
  ('Day', 'snack', 'Snack und Projekte am Nachmittag'),
  ('Day', 'pickup', 'Draußen spielen bis zum Abholen'),

  ('Visit', 'cardHeading', 'So läuft ein Besuch ab'),
  ('Visit', 'whenLabel', 'Beste Zeit zum Kommen'),
  ('Visit', 'whenValue', 'Zehn Uhr morgens, wenn die Gruppen laufen'),
  ('Visit', 'askLabel', 'Fragen Sie nach'),
  ('Visit', 'askValue', 'Maria, der Leiterin'),
  ('Visit', 'lengthLabel', 'Wie lange es dauert'),
  ('Visit', 'lengthValue', 'Etwa zwanzig Minuten'),
  ('Visit', 'bookingLabel', 'Anmeldung'),
  ('Visit', 'bookingValue', 'Kein Termin nötig'),

  ('ProgramsPage', 'metaTitle', 'Programme'),
  ('ProgramsPage', 'metaDescription', 'Gruppen für Säuglinge, Kleinkinder und Vorschulkinder in Northwest Portland — Betreuungsschlüssel, Gruppengrößen und wie ein Tag in jeder Gruppe wirklich aussieht.'),
  ('ProgramsPage', 'eyebrow', 'Alter {ageRange}'),
  ('ProgramsPage', 'heading', 'Programme nach Alter'),
  ('ProgramsPage', 'intro', 'Drei Gruppen in einem Haus und dieselben Gesichter von der Säuglingsgruppe bis zu dem Morgen, an dem Ihr Kind in die Grundschule geht. Hier steht, wer in welcher Gruppe ist, wie viele Kinder betreut werden und was der Tag bereithält.'),
  ('ProgramsPage', 'factRatio', 'Schlüssel'),
  ('ProgramsPage', 'factGroup', 'Gruppengröße'),
  ('ProgramsPage', 'factAges', 'Alter'),
  ('ProgramsPage', 'infantsDetail', 'Jedes Baby bekommt eine feste Bezugsperson, die Fläschchen, Schlaf und Wickeln übernimmt. Das ist die Person, die lernt, dass Ihre Tochter nur mit dem blauen Elefanten einschläft, und die Ihnen beim Abholen davon erzählt.'),
  ('ProgramsPage', 'infantsStaffing', 'Essen und Schlaf richten sich nach dem Rhythmus Ihres Babys, nicht nach dem der Gruppe. Sie bekommen den Tag aufgeschrieben — jedes Fläschchen, jeden Schlaf, jede Windel — bevor Sie am Auto sind.'),
  ('ProgramsPage', 'toddlersDetail', 'Das Jahr, in dem ein Kind lernt, dass die Welt eine Ordnung hat. Die Tage sind bewusst vorhersehbar, damit ein Kleinkind, das die Uhr noch nicht lesen kann, trotzdem weiß, was als Nächstes kommt — und die Sprache hört nie auf: benennen, erzählen, fragen.'),
  ('ProgramsPage', 'toddlersStaffing', 'Zwei Fachkräfte bleiben das ganze Jahr in dieser Gruppe. Das Sauberwerden geschieht im Tempo Ihres Kindes und im Einklang mit dem, was Sie zu Hause tun, nie nach einer Frist, die wir setzen.'),
  ('ProgramsPage', 'preschoolDetail', 'Erste Schrift und Zahlen — und der schwierigere Lehrplan darunter: abwarten, teilen, sagen was man fühlt, statt etwas zu werfen. Das ist die Grundlage, mit der die Grundschule rechnet.'),
  ('ProgramsPage', 'preschoolStaffing', 'Jeden Morgen Kleingruppenarbeit, geleitet von einer Fachkraft, die diese Gruppe seit Jahren unterrichtet. Im Frühjahr schreiben wir an die Grundschule Ihres Kindes, damit die erste Lehrkraft es schon kennt.'),
  ('ProgramsPage', 'dayHeading', 'Ein Tag bei Willow Grove'),
  ('ProgramsPage', 'dayBody', 'Jede Gruppe folgt demselben Rhythmus, dem Alter angepasst. Säuglinge schlafen und essen darin nach ihrem eigenen Plan; ältere Kinder gehen gemeinsam hindurch.'),
  ('ProgramsPage', 'visitHeading', 'Unsicher, welche Gruppe passt?'),
  ('ProgramsPage', 'visitBody', 'Rufen Sie im Büro an, und Sie bekommen eine klare Auskunft darüber, welche Gruppen Platz haben und wie lang die Wartezeit für die anderen ist — und dann kommen Sie und stellen sich in den Raum, in dem Ihr Kind tatsächlich wäre.'),
  ('ProgramsPage', 'visitAria', 'Besuch planen'),

  ('AboutPage', 'metaTitle', 'Über uns'),
  ('AboutPage', 'metaDescription', 'Eine lizenzierte Kindertagesstätte in Northwest Portland seit {since} — unser Ansatz, unsere Betreuungsschlüssel, unsere staatliche Lizenz und wie Sicherheit an einem gewöhnlichen Tag aussieht.'),
  ('AboutPage', 'eyebrow', 'Lizenziert seit {since}'),
  ('AboutPage', 'heading', 'Wie wir Kinder betreuen, und warum'),
  ('AboutPage', 'intro', 'Eine Einrichtung lässt sich leicht gut beschreiben und schwer gut führen. Diese Seite ist das Zweite — wie die Gruppen besetzt sind, was die Lizenz hinter der Eingangstür tatsächlich abdeckt und was an den gewöhnlichen Tagen passiert, über die niemand eine Broschüre schreibt.'),
  ('AboutPage', 'philosophyHeading', 'Woran wir glauben'),
  ('AboutPage', 'philosophyKnownTitle', 'Ein Kind sollte von wenigen gekannt werden, nicht von vielen beaufsichtigt'),
  ('AboutPage', 'philosophyKnownBody', 'Jedes Kind hat eine feste Bezugsperson, und die Fachkräfte bleiben das Jahr über bei ihrer Gruppe. Deshalb können wir Ihnen beim Abholen sagen, dass Ihr Sohn sein Mittagessen halb aufgegessen hat und dann auf dem Lesekissen eingeschlafen ist — jemand war die ganze Zeit dabei.'),
  ('AboutPage', 'philosophyRhythmTitle', 'Der Tag sollte vorhersehbar sein, das Spiel nicht'),
  ('AboutPage', 'philosophyRhythmBody', 'Jeden Tag derselbe Rhythmus — ankommen, frühstücken, Morgenkreis, raus, Mittagessen, ausruhen. Ein Kind, das weiß, was als Nächstes kommt, hat den Mut, darin erfinderisch zu sein. Erst die Struktur macht das Chaos möglich.'),
  ('AboutPage', 'philosophyPlainTitle', 'Eltern bekommen die Wahrheit, auch die unangenehmen Teile'),
  ('AboutPage', 'philosophyPlainBody', 'Wenn Ihr Kind jemanden gebissen hat, sagen wir es Ihnen. Wenn eine Gruppe voll ist und die Wartezeit neun Monate beträgt, sagen wir neun Monate, statt Sie hoffen zu lassen. Man kann sein Kind nicht dort lassen, wo man Ausweichen erlebt hat.'),
  ('AboutPage', 'ratiosHeading', 'Betreuungsschlüssel und Gruppengrößen'),
  ('AboutPage', 'ratiosBody', 'Das sind die Zahlen, mit denen wir jede Stunde besetzen, die wir geöffnet haben, kein Durchschnitt über die Woche. Beides zählt: Der Schlüssel bestimmt, wie viel Aufmerksamkeit Ihr Kind bekommt, die Gruppengröße, wie laut und wie voll es um es herum ist.'),
  ('AboutPage', 'ratiosTableCaption', 'Betreuungsschlüssel und Gruppengröße nach Gruppe'),
  ('AboutPage', 'ratiosRoom', 'Gruppe'),
  ('AboutPage', 'ratiosAges', 'Alter'),
  ('AboutPage', 'ratiosRatio', 'Schlüssel'),
  ('AboutPage', 'ratiosGroup', 'Gruppengröße'),
  ('AboutPage', 'ratiosFootnote', 'Unsere Schlüssel liegen auf oder unter dem, was die Behörde für jedes Alter verlangt, und wir halten sie über Mittagsschlaf, Mittagessen und das Ende des Tages — die Stunden, in denen ein Schlüssel am leichtesten still nachgibt.'),
  ('AboutPage', 'licensingHeading', 'Lizenz und die Kontrollen dahinter'),
  ('AboutPage', 'licensingBody', 'Wir haben seit {since} ununterbrochen eine staatliche Betriebserlaubnis für Kinderbetreuung. Eine Lizenz ist keine Urkunde an der Wand, sondern ein Prüfverfahren — und uns ist lieber, Sie wissen genau, was sie abdeckt, bevor Sie fragen.'),
  ('AboutPage', 'licensingNumberLabel', 'Staatliche Lizenz'),
  ('AboutPage', 'licensingSinceLabel', 'Lizenziert seit'),
  ('AboutPage', 'licensingInspectionsLabel', 'Prüfungen'),
  ('AboutPage', 'licensingInspectionsValue', 'Unangekündigt, mindestens jährlich'),
  ('AboutPage', 'licensingStaffLine', 'Von jeder Mitarbeiterin und jedem Mitarbeiter liegt vor dem ersten Tag mit Kindern ein Führungszeugnis vor, und alle haben aktuelle Nachweise in Erster Hilfe und Reanimation — die Leitung eingeschlossen.'),
  ('AboutPage', 'licensingCoversHeading', 'Was eine Prüfung abdeckt'),
  ('AboutPage', 'licensingCoversRatios', 'Betreuungsschlüssel und Aufsicht, Gruppe für Gruppe'),
  ('AboutPage', 'licensingCoversKitchen', 'Küche, Umgang mit Lebensmitteln und Allergiepraxis'),
  ('AboutPage', 'licensingCoversSleep', 'Sicherer Schlaf, Liegen und Schlafroutinen'),
  ('AboutPage', 'licensingCoversBuilding', 'Gebäude, Außengelände, Fluchtwege und Übungen'),
  ('AboutPage', 'licensingCoversRecords', 'Personalakten, Nachweise und Fortbildungsunterlagen'),
  ('AboutPage', 'licensingRecords', 'Die Behörde führt unsere vollständige Prüfhistorie, und Sie haben das Recht, sie einzusehen. Fragen Sie im Büro, und wir zeigen Ihnen unsere, samt Beanstandungen.'),
  ('AboutPage', 'safetyHeading', 'Sicherheit an einem gewöhnlichen Tag'),
  ('AboutPage', 'safetyBody', 'Sicherheit ist meistens nicht dramatisch. Sie besteht aus denselben kleinen Abläufen, jeden Tag gleich ausgeführt, von Menschen, die nicht improvisieren.'),
  ('AboutPage', 'safetyEntryTitle', 'Eine verschlossene Tür'),
  ('AboutPage', 'safetyEntryBody', 'Ein einziger Eingang mit Zahlencode, der jedes Halbjahr gewechselt wird. Niemand, der nicht auf der Abholliste Ihres Kindes steht, geht mit ihm hinaus — keine Ausnahmen an der Tür, nie, so plausibel die Person auch wirkt.'),
  ('AboutPage', 'safetySignInTitle', 'Angemeldet und gezählt'),
  ('AboutPage', 'safetySignInBody', 'Jedes Kind wird namentlich an- und abgemeldet, und die Fachkräfte zählen ihre Gruppe bei jedem Wechsel — in den Raum hinein, hinaus auf den Hof, vom Hof zurück.'),
  ('AboutPage', 'safetyAllergyTitle', 'Allergien und Medikamente'),
  ('AboutPage', 'safetyAllergyBody', 'Allergien hängen im Gruppenraum und in der Küche aus, die Mahlzeiten entstehen im Haus, sodass wir bestimmen, was darin ist, und Medikamente werden nur nach Ihrer schriftlichen Anweisung gegeben und dabei dokumentiert.'),
  ('AboutPage', 'safetyIllnessTitle', 'Krankheit, klar gesagt'),
  ('AboutPage', 'safetyIllnessBody', 'Fieber, Erbrechen oder etwas Ansteckendes heißt nach Hause und vierundzwanzig Stunden beschwerdefrei zu Hause bleiben. Das ist unpraktisch, und es ist der Grund, warum nicht nächste Woche die ganze Gruppe krank ist.'),
  ('AboutPage', 'safetyDrillsTitle', 'Geübt, nicht nur geplant'),
  ('AboutPage', 'safetyDrillsBody', 'Brandschutzübungen monatlich und Notfallabläufe vierteljährlich, mit den Kindern, damit ihnen der Ablauf vertraut statt beängstigend ist.'),
  ('AboutPage', 'visitHeading', 'Worauf es ankommt, erlebt man im Raum'),
  ('AboutPage', 'visitBody', 'Nichts davon ist auf einem Bildschirm viel wert. Jede Einrichtung wirkt zur Schlafenszeit ruhig; was Sie sehen wollen, ist ein Raum mit wachen Kindern darin, und das geht nur, wenn Sie darin stehen.'),
  ('AboutPage', 'visitAria', 'Besuch planen'),

  ('TuitionPage', 'metaTitle', 'Gebühren'),
  ('TuitionPage', 'metaDescription', 'Was Kinderbetreuung in Northwest Portland wirklich kostet — Monatssätze für jede Gruppe und jedes Modell, offen auf der Seite, samt der Kosten, die eine Preisliste sonst weglässt.'),
  ('TuitionPage', 'eyebrow', 'Ab {lowest} im Monat, Vollzeit'),
  ('TuitionPage', 'heading', 'Was ein Platz hier kostet'),
  ('TuitionPage', 'intro', 'Bei den meisten Einrichtungen müssen Sie dafür anrufen. Uns ist lieber, Sie sehen die Zahl jetzt und entscheiden, ob sie einen Anruf wert ist, als dass Sie es am Ende einer Führung erfahren, für die Sie einen Vormittag aufgewendet haben. Jeder Satz, den wir verlangen, steht auf dieser Seite.'),
  ('TuitionPage', 'factRegistrationLabel', 'Anmeldung'),
  ('TuitionPage', 'factRegistrationValue', '{amount}, einmalig bei der Aufnahme'),
  ('TuitionPage', 'factDepositLabel', 'Kaution'),
  ('TuitionPage', 'factDepositValue', '{weeks} Wochen, erstattet beim Austritt'),
  ('TuitionPage', 'factIncludedLabel', 'Im Satz enthalten'),
  ('TuitionPage', 'factIncludedValue', 'Mahlzeiten, Snacks, Windeln, Feuchttücher und Sonnencreme'),
  ('TuitionPage', 'factNoticeLabel', 'Kündigungsfrist'),
  ('TuitionPage', 'factNoticeValue', '{weeks} Wochen, schriftlich'),
  ('TuitionPage', 'ratesHeading', 'Monatssätze'),
  ('TuitionPage', 'ratesBody', 'Die Sätze gelten monatlich und ändern sich nicht mit der Länge des Monats — im Februar zahlen Sie dasselbe wie im März. Ein Teilzeitplatz kostet pro Tag mehr als ein Vollzeitplatz, weil die Gruppe die ganze Woche besetzt ist, ob Ihr Kind an dem Tag da ist oder nicht.'),
  ('TuitionPage', 'ratesTableCaption', 'Monatsgebühren nach Gruppe und Modell'),
  ('TuitionPage', 'ratesRoom', 'Gruppe'),
  ('TuitionPage', 'ratesFootnote', 'Die Sätze werden einmal im Jahr im September überprüft, und wir teilen es Ihnen schriftlich bis zum Juni davor mit — nie mitten im Jahr und nie mit weniger als einem Halbjahr Vorlauf.'),
  ('TuitionPage', 'fiveDayName', 'Fünf Tage'),
  ('TuitionPage', 'fiveDayDays', 'Montag bis Freitag'),
  ('TuitionPage', 'fiveDayBody', 'Die ganze Woche, und das einzige Modell, bei dem Ihr Kind jeden Tag dieselbe Gruppe um sich hat. Für Säuglinge empfehlen wir es, weil sie sich schneller einleben, wenn die Woche nicht ständig die Form wechselt.'),
  ('TuitionPage', 'threeDayName', 'Drei Tage'),
  ('TuitionPage', 'threeDayDays', 'Montag, Mittwoch, Freitag'),
  ('TuitionPage', 'threeDayBody', 'Feste Tage statt Tage, die Sie jede Woche neu wählen, damit Ihr Kind weiß, welche Morgen ihm gehören, und die Gruppe beständig bleibt. Die meisten Familien in diesem Modell teilen sich die Woche mit den Großeltern.'),
  ('TuitionPage', 'twoDayName', 'Zwei Tage'),
  ('TuitionPage', 'twoDayDays', 'Dienstag und Donnerstag'),
  ('TuitionPage', 'twoDayBody', 'Genug, um eine Routine und eine Freundschaft zu halten, ohne die ganze Woche. Plätze in diesem Modell sind die knappsten, die wir haben, weil zwei davon einen Vollzeitplatz füllen und beide zusammenpassen müssen.'),
  ('TuitionPage', 'schedulesHeading', 'Betreuungsmodelle'),
  ('TuitionPage', 'schedulesBody', 'Drei Modelle, an festen Tagen. Sie können wechseln, sobald im gewünschten Modell ein Platz frei wird, und behalten währenddessen Ihren Platz auf der Liste.'),
  ('TuitionPage', 'schedulesSwitching', 'Ein Wechsel braucht einen Monat Vorlauf und einen freien Platz in der Gruppe an den Tagen, auf die Sie wechseln. Wir sagen Ihnen ehrlich, ob das Wochen entfernt ist oder fast ein Jahr.'),
  ('TuitionPage', 'hiddenHeading', 'Die Teile, die eine Preisliste sonst weglässt'),
  ('TuitionPage', 'hiddenBody', 'Nichts davon steckt in einem Vertrag, den Sie am letzten Tag unterschreiben. Es steht hier, bevor Sie anrufen, weil die Kosten von Kinderbetreuung nicht nur die Zahl in der Tabelle sind.'),
  ('TuitionPage', 'hiddenLateTitle', 'Verspätetes Abholen'),
  ('TuitionPage', 'hiddenLateBody', '{amount} pro Minute nach achtzehn Uhr, in vollen Minuten berechnet und der nächsten Rechnung zugeschlagen. Das ist keine Strafe; es ist, was es kostet, zwei Mitarbeitende im Haus zu halten, und zwei sind das Minimum, das die Lizenz erlaubt.'),
  ('TuitionPage', 'hiddenClosuresTitle', 'Tage, an denen wir geschlossen sind'),
  ('TuitionPage', 'hiddenClosuresBody', 'Gesetzliche Feiertage, dazu drei Fortbildungstage im Jahr und die Woche zwischen Weihnachten und Neujahr. Diese werden berechnet — der Satz gilt monatlich, nicht pro besuchtem Tag — und die Termine werden jeden August ein Jahr im Voraus veröffentlicht.'),
  ('TuitionPage', 'hiddenIncreaseTitle', 'Die jährliche Erhöhung'),
  ('TuitionPage', 'hiddenIncreaseBody', 'Die Sätze steigen einmal im Jahr, meist um wenige Prozent, entsprechend dem, was wir den Fachkräften zahlen. Sie bekommen es im Juni schriftlich für einen Start im September, damit niemand von einer Rechnung überrascht wird.'),
  ('TuitionPage', 'hiddenSiblingTitle', 'Zwei Kinder bei uns'),
  ('TuitionPage', 'hiddenSiblingBody', '{percent}% Nachlass auf den Satz des jüngeren Kindes, automatisch, solange beide angemeldet sind. Sie müssen nicht danach fragen, und niemand muss daran denken, ihn einzutragen.'),
  ('TuitionPage', 'hiddenHelpTitle', 'Hilfe bei den Kosten'),
  ('TuitionPage', 'hiddenHelpBody', 'Wir akzeptieren staatliche Zuschüsse und nehmen Betreuungszuschüsse von Arbeitgebern an. Nadia kümmert sich um beides und sagt Ihnen, wofür Sie voraussichtlich infrage kommen, bevor Sie irgendetwas ausfüllen — auch dann, wenn die Antwort nichts ist.'),
  ('TuitionPage', 'visitHeading', 'Vor der Entscheidung einen Anruf wert'),
  ('TuitionPage', 'visitBody', 'Sie haben die Zahlen, und das ist das meiste von dem, was eine Führung Ihnen über Geld gesagt hätte. Offen bleibt, ob der Raum es wert ist, und genau das kann eine Preisliste Ihnen nicht zeigen.'),

  ('ContactPage', 'metaTitle', 'Kontakt'),
  ('ContactPage', 'metaDescription', 'Rufen Sie an, schreiben Sie oder kommen Sie vorbei — eine lizenzierte Kindertagesstätte in Northwest Portland: Telefon, Adresse, Öffnungszeiten, Parken und wie Sie mit Bus, Rad oder zu Fuß herkommen.'),
  ('ContactPage', 'eyebrow', 'Eine Nummer, eine Adresse'),
  ('ContactPage', 'heading', 'Rufen Sie an, oder stellen Sie sich in den Raum'),
  ('ContactPage', 'intro', 'Ans Telefon geht jemand, der hier arbeitet, kein Dienst, und Sie bekommen beim ersten Anruf eine klare Auskunft über Plätze und Wartelisten. Alles, was Sie brauchen, um uns zu erreichen oder herzufinden, steht auf dieser Seite.'),
  ('ContactPage', 'factAddressLabel', 'Adresse'),
  ('ContactPage', 'factHoursLabel', 'Geöffnet'),
  ('ContactPage', 'factClosedLabel', 'Geschlossen'),
  ('ContactPage', 'factClosedValue', 'Wochenenden und gesetzliche Feiertage'),
  ('ContactPage', 'factEmailLabel', 'E-Mail'),
  ('ContactPage', 'gettingHereHeading', 'Herkommen'),
  ('ContactPage', 'gettingHereBody', 'Wir liegen in einer Wohnstraße, was um acht Uhr morgens schön ist und lästig, wenn Sie auf Parkplatzsuche kreisen. Hier steht, wie die Bringzeit wirklich aussieht, damit Ihr erstes Abgeben nicht auch Ihr erstes Herausfinden ist.'),
  ('ContactPage', 'drivingTitle', 'Auto und Parken'),
  ('ContactPage', 'drivingBody', 'Vier markierte Plätze neben dem Gebäude sind zum Bringen und Abholen reserviert, jeweils fünfzehn Minuten. Das Parken auf der Straße ist im Block unbeschränkt, und am hinteren Ende ist selbst um halb neun meist etwas frei.'),
  ('ContactPage', 'transitTitle', 'Mit Bus oder Straßenbahn'),
  ('ContactPage', 'transitBody', 'Die nächste Bushaltestelle ist drei Gehminuten entfernt, die Straßenbahnlinie etwa acht. Beide lassen Sie auf der Parkseite der Straße aussteigen, sodass Sie einmal und abseits des Verkehrs queren.'),
  ('ContactPage', 'footTitle', 'Zu Fuß und mit dem Rad'),
  ('ContactPage', 'footBody', 'Einen Block vom Wallace Park entfernt, mit überdachtem Fahrradständer hinter dem Tor. Kinderwagen und Buggys kommen in den Eingangsflur statt in die Gruppenräume — dort ist Platz dafür, und die Türen bleiben frei.'),
  ('ContactPage', 'mapLabel', 'Kartenplatzhalter — {address}'),
  ('ContactPage', 'callHeading', 'Weswegen anrufen, und wen Sie bekommen'),
  ('ContactPage', 'callBody', 'Eine Nummer erreicht alles. Wenn Sie gleich sagen, worum es geht, kommen Sie schneller zur richtigen Person.'),
  ('ContactPage', 'callPlaceTitle', 'Ein Platz für Ihr Kind'),
  ('ContactPage', 'callPlaceBody', 'Fragen Sie nach Nadia, die die Warteliste führt. Sie sagt Ihnen, welche Gruppen Platz haben, und wenn die gewünschte keinen hat, wie lang die Wartezeit ehrlich ist — auch dann, wenn die Antwort fast ein Jahr lautet.'),
  ('ContactPage', 'callIllnessTitle', 'Ihr Kind ist heute krank'),
  ('ContactPage', 'callIllnessBody', 'Rufen Sie vor neun an, damit die Gruppe ihren Morgen planen kann. Nennen Sie das Symptom, nicht die Diagnose; ob es ein Ausschluss für vierundzwanzig Stunden ist, herauszufinden ist unsere Aufgabe, nicht Ihre.'),
  ('ContactPage', 'callHoursTitle', 'Außerhalb der Öffnungszeiten'),
  ('ContactPage', 'callHoursBody', 'Nach achtzehn Uhr läuft der Anrufbeantworter, abgehört wird er, wenn das Büro am nächsten Morgen um sieben öffnet. Über Nacht wird nichts beantwortet; was bis dahin nicht warten kann, sollte also keine Nachricht sein.'),
  ('ContactPage', 'emailNote', 'E-Mails werden einmal am Tag gelesen, nachmittags. Wenn es um einen Platz, ein Startdatum oder ein krankes Kind geht, rufen Sie bitte an — Sie bekommen die Antwort im selben Gespräch statt morgen.'),
  ('ContactPage', 'visitHeading', 'Der Besuch ist der Teil, der entscheidet'),
  ('ContactPage', 'visitBody', 'Sie haben die Nummer und wissen, wo wir sind. Übrig bleibt der Teil, den keine Seite für Sie übernehmen kann: an einem gewöhnlichen Morgen in einem Raum zu stehen und zu entscheiden, ob das die Menschen sind, denen Sie Ihr Kind anvertrauen wollen.'),

  ('FaqPage', 'metaTitle', 'FAQ'),
  ('FaqPage', 'metaDescription', 'Die Fragen, die Eltern einer lizenzierten Kindertagesstätte in Northwest Portland wirklich stellen — Wartelisten, Eingewöhnung, Essen und Allergien, Krankheit und was passiert, wenn etwas schiefgeht.'),
  ('FaqPage', 'eyebrow', '{count} Fragen, beantwortet'),
  ('FaqPage', 'heading', 'Die Fragen, die Eltern wirklich stellen'),
  ('FaqPage', 'intro', 'Diese stammen aus dem Telefon, nicht aus der Fantasie für eine Website. Auch die unangenehmen sind dabei — was passiert, wenn ein Kind beißt, wie man sich über uns beschwert — weil man genau die bei einer Führung nicht stellen kann, ohne sich unhöflich zu fühlen, und weil sich genau die zu wissen lohnt.'),
  ('FaqPage', 'factAgesLabel', 'Alter, das wir aufnehmen'),
  ('FaqPage', 'factCountLabel', 'Hier beantwortete Fragen'),
  ('FaqPage', 'factSourceLabel', 'Woher diese stammen'),
  ('FaqPage', 'factSourceValue', 'Vom Bürotelefon, über etwa ein Jahr'),
  ('FaqPage', 'factMissingLabel', 'Nicht auf dieser Liste'),
  ('FaqPage', 'factMissingValue', 'Rufen Sie an und fragen Sie — dann kommt sie dazu'),
  ('FaqPage', 'placeHeading', 'Einen Platz bekommen'),
  ('FaqPage', 'placeWaitlistQuestion', 'Wie funktioniert die Warteliste?'),
  ('FaqPage', 'placeWaitlistAnswer', 'Nach Gruppe und nach dem Datum, an dem Sie sich eingetragen haben, nicht danach, wer am häufigsten anruft. Wird ein Platz frei, gehen wir die Liste durch, und Sie haben etwa eine Woche zum Entscheiden. Niemand rückt vor, weil er mehr zahlt, und der Eintrag selbst kostet nichts.'),
  ('FaqPage', 'placeAheadQuestion', 'Wie früh sollten wir uns anmelden?'),
  ('FaqPage', 'placeAheadAnswer', 'Für die Säuglingsgruppe, sobald Sie bereit sind, von der Schwangerschaft zu erzählen — diese Gruppe ist sechs bis neun Monate im Rückstand. Plätze bei den Kleinkindern und in der Vorschule bewegen sich schneller, oft innerhalb eines Halbjahres.'),
  ('FaqPage', 'placeHoldQuestion', 'Können wir einen Platz für einen späteren Start reservieren?'),
  ('FaqPage', 'placeHoldAnswer', 'Ja, bis zu zwei Monate, mit gezahlter Kaution. Länger würde bedeuten, einen leeren Platz zu halten, den eine Familie auf der Liste braucht; dann setzen wir Sie lieber für den Monat, den Sie wirklich wollen, wieder weit nach oben.'),
  ('FaqPage', 'placeDaysQuestion', 'Können wir die Tage aussuchen?'),
  ('FaqPage', 'placeDaysAnswer', 'Sie wählen ein Modell statt einzelner Tage: fünf Tage, Montag–Mittwoch–Freitag oder Dienstag–Donnerstag. Feste Tage bedeuten, dass Ihr Kind jedes Mal dieselbe Gruppe um sich hat, und das ist das meiste von dem, was das Einleben ausmacht.'),
  ('FaqPage', 'startingHeading', 'Der Anfang bei uns'),
  ('FaqPage', 'startingSettleQuestion', 'Wie sieht die erste Woche aus?'),
  ('FaqPage', 'startingSettleAnswer', 'Zwei kurze Besuche mit Ihnen im Raum vor dem Startdatum, dann ein halber Tag, dann ein ganzer. Manche Kinder springen gleich zum ganzen Tag, manche brauchen zwei Wochen, und beides ist kein Problem — wir folgen Ihrem Kind, nicht dem Plan.'),
  ('FaqPage', 'startingBringQuestion', 'Was müssen wir mitbringen?'),
  ('FaqPage', 'startingBringAnswer', 'Wechselkleidung, eine Jacke, die dreckig werden darf, und das, womit Ihr Kind schläft. Keine Windeln, Feuchttücher, Sonnencreme oder Verpflegung — die sind im Satz enthalten, damit um sieben Uhr morgens niemand hektisch sucht.'),
  ('FaqPage', 'startingHearQuestion', 'Wie erfahren wir, wie der Tag unseres Kindes war?'),
  ('FaqPage', 'startingHearAnswer', 'Unter Dreijährige bekommen den Tag aufgeschrieben — jedes Fläschchen, jeden Schlaf, jede Windel — und Sie erhalten ihn beim Abholen. Bei älteren Kindern erzählt ihn die Fachkraft an der Tür, die tatsächlich dabei war, was mehr nützt als ein Formular.'),
  ('FaqPage', 'dailyHeading', 'Von Tag zu Tag'),
  ('FaqPage', 'dailyFoodQuestion', 'Wer kocht, und wie ist es mit Allergien?'),
  ('FaqPage', 'dailyFoodAnswer', 'Sofia kocht jede Mahlzeit im Haus, weshalb wir bei einer Allergie genau sein können, statt hoffnungsvoll auf ein Etikett zu schauen. Allergien hängen in der Küche und im Gruppenraum aus, und wir bitten Sie nicht, ein eigenes Mittagessen mitzugeben.'),
  ('FaqPage', 'dailyNappiesQuestion', 'Wie läuft das Sauberwerden?'),
  ('FaqPage', 'dailyNappiesAnswer', 'Im Tempo Ihres Kindes und im Einklang mit dem, was Sie zu Hause tun. Wir werden Ihnen nie sagen, ein Kind müsse windelfrei sein, um die Gruppe zu wechseln, und niemand bekommt das Gefühl, im Rückstand zu sein.'),
  ('FaqPage', 'dailySleepQuestion', 'Was, wenn unser Kind nicht schläft?'),
  ('FaqPage', 'dailySleepAnswer', 'Dann ruht es stattdessen leise mit einem Buch. Kein Kind wird zwei Stunden auf einer Liege gehalten, weil die Gruppe Schlafenszeit hat, und kein Kind wird geweckt, weil das Abholen näher rückt.'),
  ('FaqPage', 'dailyOutsideQuestion', 'Gehen sie auch bei Regen raus?'),
  ('FaqPage', 'dailyOutsideAnswer', 'Ja, fast täglich — das hier ist Portland, und ein Jahr drinnen auf trockenes Wetter zu warten ist keine Kindheit. Geben Sie eine Jacke und Stiefel mit, die auch unkenntlich zurückkommen dürfen.'),
  ('FaqPage', 'dailyScreensQuestion', 'Gibt es Bildschirmzeit?'),
  ('FaqPage', 'dailyScreensAnswer', 'Keine Bildschirme, in keinem Raum, in keinem Alter. Nicht als Regel, auf die wir stolz sind, sondern als eine, die wir nie brechen mussten.'),
  ('FaqPage', 'troubleHeading', 'Wenn etwas schiefgeht'),
  ('FaqPage', 'troubleSickQuestion', 'Wann ist ein Kind zu krank zum Kommen?'),
  ('FaqPage', 'troubleSickAnswer', 'Fieber, Erbrechen oder etwas Ansteckendes heißt nach Hause und vierundzwanzig Stunden beschwerdefrei zu Hause bleiben, nachdem es aufgehört hat. Das ist wirklich unpraktisch, und es ist der Grund, warum nicht in der Woche darauf die ganze Gruppe krank ist.'),
  ('FaqPage', 'troubleBitingQuestion', 'Was, wenn unser Kind beißt oder gebissen wird?'),
  ('FaqPage', 'troubleBitingAnswer', 'Beide Elternpaare erfahren es am selben Tag, und keinem wird das andere Kind genannt. Beißen ist in einer Kleinkindgruppe normal, und es ist unsere Aufgabe, zu begleiten und umzulenken, statt von einem Zweijährigen eine Erklärung zu verlangen.'),
  ('FaqPage', 'troubleInjuryQuestion', 'Was passiert, wenn unser Kind sich verletzt?'),
  ('FaqPage', 'troubleInjuryAnswer', 'Alles über ein aufgeschürftes Knie hinaus bedeutet einen Anruf, während es passiert, keinen Zettel beim Abholen. Jede Verletzung wird dokumentiert, und Sie unterschreiben den Eintrag, auch bei denen, die sich als nichts herausstellen.'),
  ('FaqPage', 'troubleComplaintQuestion', 'Wie beschweren wir uns über Sie?'),
  ('FaqPage', 'troubleComplaintAnswer', 'Sagen Sie es Maria direkt, und Sie bekommen innerhalb von zwei Tagen eine Antwort. Wenn das die Sache nicht klärt, nimmt die staatliche Aufsichtsbehörde Beschwerden über uns entgegen, ganz ohne uns, und wir geben Ihnen die Nummer selbst.'),
  ('FaqPage', 'visitHeading', 'Den Rest fragen Sie uns persönlich'),
  ('FaqPage', 'visitBody', 'Eine Liste wie diese beantwortet die Fragen, die uns schon gestellt wurden. Ihre ist vielleicht nicht dabei, und der schnellste Weg dorthin ist, im Haus zu stehen und jemanden zu fragen, der „Das weiß ich nicht, ich finde es heraus“ sagen kann, statt aus einer Seite auszuwählen.'),

  ('HomePage', 'heroEyebrow', 'Lizenzierte Kinderbetreuung · Alter {ageRange}'),
  ('HomePage', 'heroHeading', 'Ein Ort, an dem Ihr Kind beim Namen gekannt wird.'),
  ('HomePage', 'heroBody', 'Eine kleine, lizenzierte Einrichtung in {neighborhood}, in der dieselben Bezugspersonen Ihr Kind jeden Morgen begrüßen und Ihnen genau sagen können, wie sein Tag war.'),
  ('HomePage', 'planVisit', 'Besuch planen'),
  ('HomePage', 'trustInfantRatio', 'Schlüssel Säuglinge'),
  ('HomePage', 'trustYearsCaring', 'Für Familien da'),
  ('HomePage', 'trustOpenWeekdays', 'Werktags geöffnet'),
  ('HomePage', 'trustStateLicense', 'Staatliche Lizenz'),
  ('HomePage', 'programsHeading', 'Programme nach Alter'),
  ('HomePage', 'infantsBlurb', 'Eine feste Bezugsperson pro Kind, damit Fläschchen, Schlaf und erste Wörter von jemandem verfolgt werden, der Ihr Baby kennt — nicht von dem, der gerade frei ist.'),
  ('HomePage', 'toddlersBlurb', 'Platz zum Bewegen und Sprache überall. Die Tage sind vorhersehbar, damit ein Kleinkind, das die Welt lernt, sich darauf verlassen kann, was als Nächstes kommt.'),
  ('HomePage', 'preschoolBlurb', 'Erste Schrift, Zahlen und die schwierigere Arbeit des Abwartens und des Benennens von Gefühlen — die Grundlage für die Grundschule.'),
  ('HomePage', 'dayHeading', 'Ein Tag bei Willow Grove'),
  ('HomePage', 'dayBody', 'Verlässlicher Rhythmus, Platz zum Kindsein. So sehen neun Stunden tatsächlich aus.'),
  ('HomePage', 'staffHeading', 'Die Menschen, die Ihr Kind kennen werden'),
  ('HomePage', 'testimonialHeading', 'Von einer Mutter'),
  ('HomePage', 'testimonialQuote', '„Am dritten Tag sagte mir Aisha, dass meine Tochter nur einschläft, wenn sie den blauen Elefanten halten kann. Das hatte ich niemandem erzählt. Da hörte ich auf, mir Sorgen zu machen.“'),
  ('HomePage', 'testimonialAttribution', 'Priya R., Mutter eines Kindes aus der Säuglingsgruppe'),
  ('HomePage', 'visitHeading', 'Kommen Sie und sehen Sie selbst'),
  ('HomePage', 'contactAddress', 'Adresse'),
  ('HomePage', 'contactHours', 'Öffnungszeiten'),
  ('HomePage', 'contactPhone', 'Telefon'),
  ('HomePage', 'mapLabel', 'Karte von {neighborhood}'),

  ('Footer', 'tagline', 'Lizenzierte Kindertagesstätte · Staatliche Lizenz {licenseNumber} · Für Familien da seit {since}.')
) as v (namespace, key, value)
where o.slug = 'willow-grove'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;
