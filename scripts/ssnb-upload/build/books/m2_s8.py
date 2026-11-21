# Module 2, Section 8 (Equipment): a reference module. Activities and videos for the devices.
from lib import *

MERGE = [['Oxygen concentrators', 'Oxygen Blender']]
ADD = [
    ('Hyperthermia & heat stress', [
        q('Where is the radiant warmer\'s skin probe placed on a baby lying supine, and what is the target temperature?', ['Over the right hypochondrium; 36.5–37.0 °C', 'On the forehead; 38 °C', 'In the axilla; 35.5 °C', 'On the foot; 37.5–38 °C'], 0,
          'In prone position the probe goes on the flank. Turn the warmer on 20 minutes before the baby arrives; check the probe every 2–3 hours; change the probe site every 24 hours; one radiant warmer, one baby.'),
        video('Using a radiant warmer', 'Pre-warming for 20 minutes, choosing manual or servo mode, setting 36.5–37.0 °C, fixing the skin probe over the right hypochondrium, responding to alarms.', 'SN2.8.1')]),
    ('The control and power units should be calibrated every 4-6 months', q(
        'How are the radiant warmer\'s external surfaces cleaned?', ['Daily with light detergent or soap, then chlorine or glutaraldehyde; no spirit or organic solvent', 'With spirit only', 'Once a month with water', 'Never while in use'], 0,
        'The reusable probe is cleaned with an isopropyl alcohol swab. Inspect the heating element weekly.')),
    ('Use chlorine base solution 0.05% for 20 min only if there is blood', [
        q('How long does the Embrace WarmPak keep the baby warm, and how long is it heated?', ['4–6 hours; heated in the AccuTemp heater for 30 minutes', '24 hours; 5 minutes', '1 hour; 2 hours', 'It is not heated'], 0,
          'The wax melts at 37 °C and releases heat as it solidifies. Use the Rainbow sign to monitor the target temperature.'),
        video('Using the Embrace portable warmer', 'Heating the WarmPak for 30 minutes, placing it in the BabyWrap pouch, putting the baby in, reading the Rainbow sign, cleaning after use.', 'SN2.8.2')]),
    ('pour 250ml of 24% acetic acid once weekly', [
        sort('Manual (air) mode: which incubator air temperature for which baby?', ['34–36 °C', '33–34 °C', '32–33 °C'], [
            ('Extremely preterm (< 28 weeks)', '34–36 °C'), ('Very preterm (28–32 weeks)', '33–34 °C'), ('Near-term or term', '32–33 °C')],
            'In servo (skin) mode, set 36.5–37 °C. Humidity 40–70%, or 70–90% in the first week for babies < 1500 g.'),
        video('Setting up an infant incubator', 'Checking it is clean, power, choosing servo or air mode, skin probe, distilled water in the reservoir, humidity, closing the portholes.', 'SN2.8.3')]),
    ('Every 3 months or following use on an infected baby', q(
        'How often are the incubator door handles and latches disinfected?', ['3 times a day', 'Once a week', 'Once a month', 'Only between patients'], 0,
        'From the manual\'s disinfection frequency table. The humidifier water is changed daily with sterile or distilled water.')),
    ('Store the device in its pre-assembled form in a clean container', [
        q('How often are the Vayu CPAP water jars and filter disk replaced?', ['Every 24 hours (the filter earlier if discoloured or after each patient)', 'Every week', 'Every month', 'Only when empty'], 0,
          'Ensure continuous bubbling at all times. High-level disinfection: 0.5% chlorine for 10 minutes or 2.5–3.5% glutaraldehyde for 40 minutes; never autoclave or boil.'),
        video('Vayu bubble CPAP: assembly and disinfection', 'Identifying the parts, assembling, filling the humidifier and pressure generator to their marks, then disassembly, cleaning and high-level disinfection.', 'SN2.8.4')]),
    ('Clean with spirit swab and let it dry before and after any using', [
        q('Which of these can make the pulse oximeter reading unreliable?', ['Low perfusion, abnormal haemoglobins, or light from a phototherapy unit', 'A warm, well-perfused hand', 'A probe with both sides facing each other', 'Alarm limits set'], 0,
          'Change the probe site every 6–8 hours if it is on continuously.'),
        video('Pulse oximeter: standard operating procedure', 'Hand hygiene, cleaning the probe, choosing a warm well-perfused site, the two sides facing each other, securing the probe, setting the alarm limits.', 'SN2.8.5')]),
    ('Monitor bilirubin level at least once in 24 hours', q(
        'How far is the phototherapy light from the baby\'s skin in the manual?', ['About 45 cm', '5 cm', '1 metre', '2 metres'], 0,
        'Blue light 450–460 nm. Only a small diaper; cover the eyes and gonads; turn the baby after each feed or 2-hourly; continue frequent breastfeeding.')),
    ('After use clean and store in cardboard box', q(
        'Before connecting a syringe pump to the baby, what must you do?', ['Press and hold PURGE to remove air from the syringe and tubing', 'Press RUN immediately', 'Shake the syringe', 'Nothing'], 0,
        'From the syringe pump procedure.')),
    ('Do not allow any solution to splash on the drip sensor connector', [
        q('How is the infusion pump cleaned?', ['Power off, unplug, and wipe with gauze moistened with cold or tepid water; never immerse it or use alcohol or solvents', 'Immerse it in chlorine', 'Wipe with acetone', 'Autoclave it'], 0,
          'From "Infusion pump disinfection".'),
        video('Setting up syringe and infusion pumps', 'Loading a syringe, purging, setting the rate; loading an infusion set, drop sensor, flow rate and volume.', 'SN2.8.6')]),
    ('Disinfect collection reservoir after each patienta. Remove the tube from suction pump.', [
        q('Suctioning a newborn: what is the maximum negative pressure, and for how long?', ['Not over 100 mm Hg; 10–15 seconds at a time', '200 mm Hg; 1 minute', '50 mm Hg; continuous', 'Any pressure; until clear'], 0,
          'Preterm catheter 4–5 Fr; neonate 6 Fr; insert only 5 cm in the mouth. Stop if the heart rate falls by 20 or rises by 40, or with ectopy. No more than 4 suctions per episode.'),
        video('Suctioning a newborn safely', 'Checking the pressure, catheter size, positioning, gentle intermittent suction of the mouth then nose, watching the heart rate; cleaning the machine.', 'SN2.8.7')]),
    ('Also, can be autoclaved at 136°C', q(
        'Using a suction bulb on a newborn: what is the first step at the nose?', ['Squeeze the air out of the bulb first, then place the tip gently in the nostril and let go', 'Put the tip in, then squeeze', 'Squeeze inside the nostril repeatedly', 'Use it on the mouth only'], 0,
        'Then squeeze the mucus out onto a tissue and do the other nostril. Wash in soapy water, then chlorine for 20 minutes.')),
    ('Dry the device using a sterile cloth', [
        q('Bag and mask ventilation: what rate, and how do you know it is effective?', ['30–60 breaths a minute; the chest rises and falls', '100 breaths a minute; the baby cries', '10 breaths a minute; the bag empties', '60–80 a minute; the saturation is 100%'], 0,
          'If the chest does not rise: check the bag–mask connection, the mask position and the head position. Excessive pressure can cause a pneumothorax.'),
        video('Bag and mask: checking, ventilating and cleaning', 'Testing the bag, fitting the mask over nose and mouth, the grip, ventilating 30–60 a minute watching the chest; reprocessing after use.', 'SN2.8.8')]),
    ('Allow the solution to remain on the surface for 10 min', q(
        'How far from walls or curtains is an oxygen concentrator placed?', ['At least 30 cm, so the air inlet is not blocked', 'Against the wall', 'In a closed cupboard', 'It does not matter'], 0,
        'A green light shows when a high enough oxygen concentration is reached, usually within 10 minutes. Clean the inlet filter in warm soapy water.')),
]
