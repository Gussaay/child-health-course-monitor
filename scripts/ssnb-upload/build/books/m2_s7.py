# Module 2, Section 7 (Neonatal Procedures): a reference module. Activities and a video per procedure.
from lib import *
from books.titles import M2_S7

ADD = [
    ('Universal precautions and proper sterile technique should be followed', q(
        'What must the physician document before an invasive procedure?', ['The informed consent process: date, time, who was present, the conversation, diagnosis, procedure, risks, benefits and alternatives', 'Only the time', 'Nothing if the baby is very sick', 'Only the result'], 0,
        'A refusal, and the risks of refusing that were discussed, are documented too.')),
    ('Gentile rubbing, taping or vibrating one extremity', [
        q('How much 25% sucrose is given to a preterm newborn before a painful procedure, and when?', ['0.5–1.5 ml by mouth about 2 minutes before', '5 ml after the procedure', '10 ml IV', 'None: sucrose is only for term babies'], 0,
          'Term newborns: 25–30% sucrose 1.5–3 ml about 2 minutes before. Add swaddling, non-nutritive sucking, and skin-to-skin after.'),
        video('Preventing pain during procedures', 'Clustering care, swaddling, non-nutritive sucking, oral sucrose 2 minutes before a heel prick, and skin-to-skin after.', 'SN2.7.1')]),
    ('Never use hypoosmolar fluids in the UA', [
        calc('A baby weighs 2 kg. Using the manual\'s formula, how long is the UAC high line?', 15, 'cm', explanation='UAC high line (cm) = (3 × BW in kg) + 9 = 3 × 2 + 9 = 15 cm. The high line tip lies between T6 and T9.'),
        video('Umbilical artery catheterization', 'Measuring, preparing the cord, identifying the two arteries and the vein, dilating an artery, advancing the catheter, confirming the tip by X-ray, securing.', 'SN2.7.2')]),
    ('Attempt to establish a peripheral IV line again, and treat for infection', [
        calc('For the same 2 kg baby (UAC high line 15 cm), how long is the UVC?', 8.5, 'cm', explanation='UVC length (cm) = 0.5 × UAC high line + 1 = 0.5 × 15 + 1 = 8.5 cm.'),
        q('Which of these is a contraindication to umbilical vein catheterization?', ['Omphalitis or suspected NEC', 'Weight under 1000 g', 'Need for exchange transfusion', 'FiO₂ above 40% on CPAP'], 0,
          'The other three are indications in the manual. Contraindications: omphalitis, peritonitis, possible or confirmed NEC, intestinal hypoperfusion, umbilical sepsis.'),
        video('Umbilical vein catheterization (UVC)', 'Isolating the thin-walled vein, advancing until blood flows back freely, securing, connecting the infusion without air, confirming the tip position.', 'SN2.7.3')]),
    ('the junction between the polyurethane part of the catheter', [
        q('When does the CDC recommend PICC access?', ['When therapy is needed for more than 6 days', 'For every admission', 'Only for blood sampling', 'Only in term babies'], 0,
          'Upper limb insertions are measured to the suprasternal notch; lower limb insertions to the umbilicus.'),
        video('Inserting a PICC line', 'Measuring the insertion distance, full aseptic technique, introducer, advancing with non-toothed forceps, securing with steristrip and transparent dressing.', 'SN2.7.4')]),
    ('Remove the intraosseous needle as soon as alternative IV access', [
        q('Where is the first-choice site for intraosseous access in a newborn?', ['The anteromedial proximal tibia, 1–2 cm below and slightly medial to the tibial tuberosity', 'The sternum', 'The skull', 'The heel'], 0,
          'Remove the IO line as soon as other IV access is established, within eight hours if possible.'),
        video('Intraosseous access', 'Positioning the leg, inserting an 18-gauge IO needle with a rotary motion, checking with 3 ml of fluid, looking for swelling, securing.', 'SN2.7.5')]),
    ('Update parents', [
        q('What is the gold standard to confirm the ETT position, and where should the tip be?', ['Chest X-ray; tip 1 cm above the carina (T2–T3)', 'Listening only; tip at T8', 'Saturation only; anywhere in the trachea', 'CO₂ detector only; at the vocal cords'], 0,
          'At the bedside: chest rise, air entry on auscultation and a CO₂ detector.'),
        video('Endotracheal intubation of a newborn', 'Laryngoscope in the left hand, blade pushing the tongue left, lifting forward and up, tube passed through the cords from the side, depth by the naso-tragal measurement + 1 cm, confirmation.', 'SN2.7.6')]),
    ('It is advised not to completely evacuate chest prior to placement', [
        q('Where is a needle inserted to relieve a tension pneumothorax?', ['The anterior second intercostal space, midclavicular line, over the top of the rib', 'The 8th intercostal space, back', 'Below the rib, mid-axillary line', 'The fourth space, left sternal edge'], 0,
          'Over the superior aspect of the rib margin avoids the neurovascular bundle. A chest tube follows for ongoing air release.'),
        video('Needle thoracotomy for tension pneumothorax', 'Landmarks, angiocatheter with a saline-filled syringe, bubbles on entry, three-way stopcock and aspiration.', 'SN2.7.7')]),
    ('Occlusive dressing (Tegaderm, xeroform, 4 x 4 gauze)', q(
        'Which chest tube size does the manual give for a baby under 1500 g?', ['8F to 10F', '10F to 12F', '16F', '4F'], 0,
        '10F to 12F for infants over 1500 g.')),
    ('A post-removal chest x-ray is indicated to assess for pneumothorax development', []),
    ('A chest x-ray should be obtained to monitor the patient\'s condition', [
        q('Where is the chest tube usually inserted?', ['4th or 5th intercostal space, anterior mid-axillary line', '2nd intercostal space, midclavicular line', '8th intercostal space, posterior', 'Just below the nipple, medially'], 0,
          'Placing it more inferiorly risks the liver or spleen; more anteriorly risks the thymus, great vessels or heart.'),
        video('Chest tube insertion and the drainage system', 'Landmark, incision, blunt dissection over the rib, entering the pleura, guiding the tube, securing, connecting to the underwater seal; removal at peak inspiration.', 'SN2.7.8')]),
    ('apply an adhesive bandage to the site', [
        q('Where is a lumbar puncture done in a newborn?', ['L3–L4 or L4–L5, found on the line between the tops of the iliac crests', 'T12–L1', 'L1–L2', 'The cervical spine'], 0,
          'Baby in the lateral position with hips, knees and neck flexed, without compromising breathing. Tube 1 for culture and Gram stain, tube 2 glucose and protein, last tube cell count.'),
        video('Lumbar puncture in a newborn', 'Positioning and holding the baby, the landmark, sterile preparation, needle angled to the umbilicus, collecting three tubes.', 'SN2.7.9')]),
    ('Secure catheter tubing to inner thigh', [
        q('What catheter size is used for a newborn\'s urinary catheterization?', ['6 Fr', '12 Fr', '3.5 Fr', '16 Fr'], 0,
          'For urine culture, the baby should not have voided within 1 hour.'),
        video('Urinary bladder catheterization', 'Sterile preparation; male and female technique; advancing the lubricated catheter; collecting the specimen.', 'SN2.7.10')]),
    ('Remove needle, cleanse skin of iodine, and apply a sterile bandage', [
        q('Where is suprapubic aspiration done?', ['1–2 cm above the symphysis pubis in the midline', '5 cm above the umbilicus', 'In the flank', 'At the umbilicus'], 0,
          'A 22-gauge 1.5-inch needle, 10–20 degrees from the perpendicular, aiming slightly caudad, not more than 3 cm deep.'),
        video('Suprapubic bladder aspiration', 'Frog-leg position, the landmark, needle angle, gentle suction until urine enters the syringe.', 'SN2.7.11')]),
]
ADD = [a for a in ADD if a[1]]
