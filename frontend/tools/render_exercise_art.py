#!/usr/bin/env python3
"""Render the checked-in local SVGs. Run with --check to check for drift.

A pose contains the head, shoulder and hip centres, then two arms and
two legs. Each limb gives its joint and endpoint, with the far side first.
Captions, equipment and motion arrows are specified per frame.
"""
import argparse
from math import atan2, cos, sin
from pathlib import Path
from xml.sax.saxutils import escape

POSES = {'cadera': [((136, 105),
             (113, 120),
             (67, 120),
             [(120, 151, 125, 181), (110, 153, 109, 181)],
             [(61, 177, 38, 183), (72, 176, 51, 183)]),
            ((136, 105),
             (113, 120),
             (67, 120),
             [(120, 151, 125, 181), (110, 153, 109, 181)],
             [(61, 177, 38, 183), (38, 134, 36, 159)])],
 'toracica': [((137, 103),
               (113, 119),
               (65, 124),
               [(117, 153, 119, 181), (136, 129, 130, 107)],
               [(64, 176, 40, 182), (70, 171, 49, 180)]),
              ((123, 91),
               (111, 117),
               (65, 124),
               [(117, 153, 119, 181), (91, 75, 115, 89)],
               [(64, 176, 40, 182), (70, 171, 49, 180)])],
 'hombro': [((91, 65),
             (91, 91),
             (91, 131),
             [(62, 103, 42, 83), (120, 103, 140, 83)],
             [(77, 155, 72, 182), (105, 155, 110, 182)]),
            ((91, 65),
             (91, 91),
             (91, 131),
             [(66, 71, 53, 43), (116, 71, 129, 43)],
             [(77, 155, 72, 182), (105, 155, 110, 182)])],
 'plancha': [((139, 133),
              (120, 151),
              (77, 159),
              [(121, 180, 150, 180), (114, 175, 143, 175)],
              [(50, 166, 30, 182), (53, 162, 34, 178)]),
             ((140, 115),
              (120, 132),
              (78, 146),
              [(120, 179, 150, 179), (113, 174, 143, 174)],
              [(51, 159, 26, 181), (53, 155, 31, 177)])],
 'lateral': [((141, 128),
              (122, 146),
              (81, 170),
              [(123, 180, 149, 180), (99, 154, 84, 164)],
              [(55, 176, 29, 181), (57, 172, 33, 177)]),
             ((141, 108),
              (122, 129),
              (81, 151),
              [(123, 180, 149, 180), (99, 135, 83, 146)],
              [(55, 166, 29, 181), (57, 162, 33, 177)])],
 'puente': [((34, 170),
             (57, 173),
             (96, 174),
             [(74, 181, 94, 181), (77, 179, 99, 179)],
             [(125, 138, 140, 181), (134, 138, 150, 181)]),
            ((34, 170),
             (57, 170),
             (94, 139),
             [(74, 180, 94, 180), (77, 177, 99, 177)],
             [(128, 129, 140, 181), (135, 131, 150, 181)])],
 'nordico': [((115, 61),
              (108, 86),
              (103, 132),
              [(118, 113, 122, 129), (111, 114, 113, 128)],
              [(103, 177, 55, 180), (98, 176, 52, 178)]),
             ((166, 106),
              (148, 123),
              (123, 145),
              [(156, 147, 163, 168), (148, 145, 154, 165)],
              [(103, 177, 55, 180), (98, 176, 52, 178)])],
 'zancada': [((96, 57),
              (94, 83),
              (91, 124),
              [(108, 102, 117, 119), (80, 103, 73, 119)],
              [(109, 150, 137, 181), (68, 150, 44, 181)]),
             ((100, 83),
              (98, 106),
              (92, 144),
              [(112, 123, 118, 137), (84, 124, 79, 136)],
              [(132, 146, 133, 181), (70, 170, 42, 180)])],
 'sentadilla': [((103, 57),
                 (96, 82),
                 (93, 122),
                 [(111, 109, 120, 92), (104, 109, 113, 92)],
                 [(103, 149, 103, 181), (92, 149, 92, 181)]),
                ((110, 87),
                 (97, 111),
                 (65, 144),
                 [(114, 136, 126, 117), (106, 133, 117, 117)],
                 [(120, 145, 102, 181), (113, 142, 92, 181)])],
 'remo': [((56, 58),
           (57, 84),
           (58, 125),
           [(83, 93, 113, 91), (80, 99, 109, 97)],
           [(64, 153, 73, 181), (48, 152, 44, 181)]),
          ((56, 58),
           (57, 84),
           (58, 125),
           [(37, 110, 76, 96), (34, 107, 72, 91)],
           [(64, 153, 73, 181), (48, 152, 44, 181)])],
 'pasos': [((85, 74),
            (86, 100),
            (86, 133),
            [(63, 116, 78, 107), (109, 116, 94, 107)],
            [(62, 154, 54, 181), (112, 154, 120, 181)]),
           ((108, 74),
            (109, 100),
            (108, 133),
            [(86, 116, 101, 107), (132, 116, 117, 107)],
            [(86, 154, 79, 181), (135, 153, 149, 181)])],
 'altura': [((96, 57),
             (95, 83),
             (90, 123),
             [(109, 103, 121, 95), (92, 108, 112, 106)],
             [(113, 146, 126, 181), (72, 151, 53, 181)]),
            ((102, 90),
             (99, 112),
             (88, 144),
             [(114, 131, 127, 117), (96, 134, 116, 130)],
             [(125, 148, 126, 181), (72, 167, 53, 181)])],
 'balanceo': [((62, 95),
               (68, 120),
               (81, 172),
               [(89, 137, 114, 143), (85, 133, 108, 141)],
               [(119, 143, 146, 181), (126, 140, 154, 181)]),
              ((46, 115),
               (58, 138),
               (81, 172),
               [(79, 145, 107, 144), (75, 141, 102, 141)],
               [(119, 143, 146, 181), (126, 140, 154, 181)])],
 'equilibrio': [((90, 60),
                 (90, 85),
                 (90, 123),
                 [(67, 109, 50, 119), (113, 109, 130, 119)],
                 [(77, 151, 73, 181), (104, 151, 108, 181)]),
                ((86, 60),
                 (86, 85),
                 (86, 123),
                 [(63, 109, 47, 119), (109, 109, 126, 119)],
                 [(83, 151, 81, 181), (115, 144, 105, 164)])],
 'salto': [((91, 75),
            (91, 99),
            (91, 134),
            [(65, 121, 52, 137), (117, 121, 130, 137)],
            [(73, 155, 69, 181), (109, 155, 113, 181)]),
           ((91, 51),
            (91, 76),
            (91, 111),
            [(69, 58, 63, 38), (113, 58, 119, 38)],
            [(78, 135, 74, 158), (104, 135, 108, 158)]),
           ((91, 75),
            (91, 99),
            (91, 134),
            [(65, 114, 54, 104), (117, 114, 128, 104)],
            [(73, 155, 69, 181), (109, 155, 113, 181)])],
 'pantorrilla': [((110, 67),
                  (106, 91),
                  (88, 128),
                  [(123, 113, 159, 99), (126, 118, 159, 107)],
                  [(120, 151, 129, 181), (61, 154, 49, 181)]),
                 ((124, 74),
                  (115, 97),
                  (94, 132),
                  [(135, 121, 159, 99), (137, 125, 159, 107)],
                  [(134, 154, 129, 181), (68, 155, 49, 181)])],
 'press-pecho': [((41, 111),
                  (63, 117),
                  (108, 120),
                  [(55, 114, 54, 93), (75, 113, 77, 91)],
                  [(138, 145, 145, 182), (128, 147, 133, 182)]),
                 ((41, 111),
                  (63, 117),
                  (108, 120),
                  [(62, 86, 56, 60), (70, 86, 76, 61)],
                  [(138, 145, 145, 182), (128, 147, 133, 182)])],
 'peso-rumano': [((95, 59),
                  (91, 85),
                  (88, 125),
                  [(99, 112, 101, 140), (94, 112, 93, 141)],
                  [(94, 154, 95, 181), (83, 154, 83, 181)]),
                 ((137, 105),
                  (115, 117),
                  (71, 128),
                  [(113, 140, 115, 164), (108, 141, 105, 165)],
                  [(87, 153, 83, 181), (79, 152, 75, 181)])],
 'talones': [((96, 60),
              (94, 85),
              (91, 127),
              [(117, 103, 151, 99), (113, 105, 151, 107)],
              [(91, 154, 89, 181), (101, 154, 99, 181)]),
             ((108, 46),
              (105, 71),
              (102, 113),
              [(125, 93, 151, 99), (124, 98, 151, 107)],
              [(102, 142, 97, 169), (112, 142, 107, 169)])],
 'escalon': [((77, 59),
              (80, 84),
              (78, 125),
              [(96, 102, 103, 122), (64, 105, 55, 121)],
              [(108, 127, 124, 153), (67, 154, 58, 181)]),
             ((126, 32),
              (127, 58),
              (126, 99),
              [(145, 81, 150, 97), (113, 80, 105, 98)],
              [(127, 125, 127, 153), (139, 126, 144, 153)])],
 'apertura-banda': [((95, 58),
                     (95, 84),
                     (95, 124),
                     [(67, 96, 78, 88), (126, 96, 113, 88)],
                     [(80, 151, 76, 181), (109, 151, 114, 181)]),
                    ((95, 58),
                     (95, 84),
                     (95, 124),
                     [(63, 87, 29, 89), (126, 87, 159, 89)],
                     [(80, 151, 76, 181), (109, 151, 114, 181)])],
 'curl-banda': [((95, 58),
                 (95, 84),
                 (95, 124),
                 [(74, 108, 68, 137), (116, 108, 122, 137)],
                 [(80, 151, 76, 181), (109, 151, 114, 181)]),
                ((95, 58),
                 (95, 84),
                 (95, 124),
                 [(72, 110, 69, 84), (118, 110, 121, 84)],
                 [(80, 151, 76, 181), (109, 151, 114, 181)])],
 'press-banda': [((95, 65),
                  (95, 91),
                  (95, 127),
                  [(62, 103, 63, 79), (128, 103, 128, 79)],
                  [(80, 155, 76, 181), (109, 155, 114, 181)]),
                 ((95, 65),
                  (95, 91),
                  (95, 127),
                  [(69, 63, 68, 34), (121, 63, 122, 34)],
                  [(80, 155, 76, 181), (109, 155, 114, 181)])],
 'rotacion-banda': [((95, 58),
                     (95, 84),
                     (95, 124),
                     [(78, 116, 85, 105), (112, 116, 106, 105)],
                     [(80, 151, 76, 181), (109, 151, 114, 181)]),
                    ((95, 58),
                     (95, 84),
                     (95, 124),
                     [(78, 116, 48, 110), (112, 116, 144, 110)],
                     [(80, 151, 76, 181), (109, 151, 114, 181)])]}

CAPTIONS = {'cadera': ('Cuatro apoyos', 'Abre la rodilla'),
 'toracica': ('Mano en la cabeza', 'Gira hacia arriba'),
 'hombro': ('Banda al frente', 'Eleva los brazos'),
 'plancha': ('Apoya los codos', 'Alinea el cuerpo'),
 'lateral': ('Apoya el antebrazo', 'Eleva la cadera'),
 'puente': ('Pies apoyados', 'Eleva la pelvis'),
 'nordico': ('Rodillas apoyadas', 'Inclina el cuerpo'),
 'zancada': ('Da un paso', 'Flexiona y sube'),
 'sentadilla': ('Carga al pecho', 'Baja con control'),
 'remo': ('Brazos al frente', 'Codos atrás'),
 'pasos': ('Base estable', 'Paso lateral'),
 'altura': ('Un pie delante', 'Baja con control'),
 'balanceo': ('Posición sentada', 'Lleva el peso atrás'),
 'equilibrio': ('Pies apoyados', 'Eleva un pie'),
 'salto': ('Flexiona', 'Salta bajo', 'Aterriza'),
 'pantorrilla': ('Un pie atrás', 'Talón en el suelo'),
 'press-pecho': ('Mancuernas al pecho', 'Empuja hacia arriba'),
 'peso-rumano': ('Carga junto al cuerpo', 'Lleva la cadera atrás'),
 'talones': ('Planta en el suelo', 'Eleva los talones'),
 'escalon': ('Apoya todo el pie', 'Sube con control'),
 'apertura-banda': ('Banda al frente', 'Separa las manos'),
 'curl-banda': ('Brazos abajo', 'Flexiona los codos'),
 'press-banda': ('Manos a los hombros', 'Empuja hacia arriba'),
 'rotacion-banda': ('Codos al costado', 'Abre los antebrazos')}

MOTION = {'cadera': (None, (60, 163, 49, 148, 34, 137)),
 'toracica': (None, (67, 102, 64, 78, 84, 65)),
 'hombro': (None, (34, 80, 29, 54, 43, 32)),
 'plancha': (None, (77, 180, 71, 165, 77, 150)),
 'lateral': (None, (80, 181, 74, 169, 80, 156)),
 'puente': (None, (97, 169, 105, 153, 96, 137)),
 'nordico': (None, (100, 55, 132, 63, 151, 85)),
 'zancada': (None, (148, 104, 152, 122, 149, 145)),
 'sentadilla': (None, (45, 99, 38, 123, 48, 145)),
 'remo': (None, (111, 68, 91, 62, 72, 70)),
 'pasos': (None, (68, 60, 98, 50, 127, 59)),
 'altura': (None, (151, 87, 154, 104, 152, 123)),
 'balanceo': (None, (85, 96, 67, 87, 49, 93)),
 'equilibrio': (None, (137, 179, 134, 163, 122, 149)),
 'salto': (None, (151, 157, 156, 122, 153, 84), (148, 97, 152, 126, 147, 157)),
 'pantorrilla': (None, (83, 82, 96, 75, 108, 83)),
 'press-pecho': (None, (95, 100, 101, 78, 99, 55)),
 'peso-rumano': (None, (81, 106, 65, 109, 50, 120)),
 'talones': (None, (64, 172, 61, 150, 68, 132)),
 'escalon': (None, (78, 129, 68, 99, 83, 76)),
 'apertura-banda': (None, (64, 66, 49, 60, 33, 67)),
 'curl-banda': (None, (142, 136, 152, 110, 139, 92)),
 'press-banda': (None, (147, 92, 152, 67, 145, 45)),
 'rotacion-banda': (None, (135, 91, 147, 83, 156, 92))}

EQUIPMENT = {'hombro': [('band', 'M42 83H140'), ('band', 'M53 43H129')],
 'remo': [('band', 'M112 91 164 88 110 97'), ('band', 'M76 96 164 88 72 91')],
 'sentadilla': [('weight', 'M112 87h11m-9-3v6m8-6v6'), ('weight', 'M116 114h12m-10-3v6m8-6v6')],
 'nordico': [('support', 'M30 177h29'), ('support', 'M30 177h29')],
 'pantorrilla': [('support', 'M163 70v116'), ('support', 'M163 70v116')],
 'press-pecho': [('support', 'M25 127h100m-89 1v56m78-56v56'), ('support', 'M25 127h100m-89 1v56m78-56v56')],
 'talones': [('support', 'M155 87v99'), ('support', 'M155 87v99')],
 'escalon': [('platform', 'M102 186v-29h66v29Z'), ('platform', 'M102 186v-29h66v29Z')],
 'apertura-banda': [('band', 'M78 88q17 12 35 0'), ('band', 'M29 89q65 9 130 0')],
 'curl-banda': [('band', 'M68 137 77 181H114L122 137'), ('band', 'M69 84 77 181H114L121 84')],
 'press-banda': [('band', 'M63 79 76 181H114L128 79'), ('band', 'M68 34 76 181H114L122 34')],
 'rotacion-banda': [('band', 'M85 105q11 8 21 0'), ('band', 'M48 110q48 7 96 0')]}

WEIGHTS = {'press-pecho': ['M46 93h16m-14-4v8m12-8v8m9-6h16m-14-4v8m12-8v8', 'M48 60h16m-14-4v8m12-8v8m6-3h16m-14-4v8m12-8v8'], 'peso-rumano': ['M88 142h22m-20-4v8m16-8v8', 'M99 168h24m-22-4v8m19-8v8']}
POSES.update({'abdominal-corto': [((30, 172),
                      (51, 175),
                      (92, 176),
                      [(67, 156, 77, 161), (67, 159, 78, 167)],
                      [(124, 140, 143, 181), (131, 144, 152, 181)]),
                     ((37, 151),
                      (58, 160),
                      (92, 176),
                      [(75, 147, 83, 155), (75, 151, 84, 160)],
                      [(124, 140, 143, 181), (131, 144, 152, 181)])],
 'banca-barra': [((35, 110),
                  (53, 117),
                  (105, 120),
                  [(69, 119, 66, 100), (64, 123, 60, 101)],
                  [(134, 143, 143, 181), (126, 146, 131, 181)]),
                 ((35, 110),
                  (53, 117),
                  (105, 120),
                  [(59, 85, 62, 52), (53, 84, 56, 51)],
                  [(134, 143, 143, 181), (126, 146, 131, 181)])],
 'curl-femoral': [((62, 58),
                   (67, 84),
                   (73, 126),
                   [(83, 107, 108, 117), (81, 106, 103, 116)],
                   [(118, 129, 158, 133), (111, 130, 150, 136)]),
                  ((62, 58),
                   (67, 84),
                   (73, 126),
                   [(83, 107, 108, 117), (81, 106, 103, 116)],
                   [(118, 129, 106, 172), (111, 130, 99, 169)])],
 'curl-mancuerna': [((95, 55),
                     (95, 81),
                     (95, 126),
                     [(70, 107, 65, 137), (119, 107, 124, 137)],
                     [(82, 151, 79, 181), (108, 151, 111, 181)]),
                    ((95, 55),
                     (95, 81),
                     (95, 126),
                     [(70, 107, 65, 84), (119, 107, 124, 84)],
                     [(82, 151, 79, 181), (108, 151, 111, 181)])],
 'dead-bug': [((30, 169),
               (51, 172),
               (91, 173),
               [(49, 144, 47, 119), (57, 143, 57, 116)],
               [(101, 134, 133, 134), (110, 136, 140, 139)]),
              ((30, 169),
               (51, 172),
               (91, 173),
               [(49, 144, 47, 119), (30, 150, 12, 152)],
               [(125, 162, 157, 160), (110, 136, 140, 139)])],
 'elevacion-lateral': [((95, 55),
                        (95, 81),
                        (95, 126),
                        [(68, 108, 63, 137), (122, 108, 127, 137)],
                        [(82, 151, 79, 181), (108, 151, 111, 181)]),
                       ((95, 55),
                        (95, 81),
                        (95, 126),
                        [(55, 86, 27, 89), (136, 86, 163, 89)],
                        [(82, 151, 79, 181), (108, 151, 111, 181)])],
 'extension-rodilla': [((62, 58),
                        (67, 84),
                        (73, 126),
                        [(83, 108, 88, 129), (81, 107, 85, 127)],
                        [(118, 129, 121, 174), (111, 130, 114, 175)]),
                       ((62, 58),
                        (67, 84),
                        (73, 126),
                        [(83, 108, 88, 129), (81, 107, 85, 127)],
                        [(118, 129, 161, 131), (111, 130, 151, 136)])],
 'flexiones': [((148, 98),
                (129, 116),
                (84, 139),
                [(132, 146, 139, 181), (124, 146, 130, 181)],
                [(57, 155, 31, 172), (54, 158, 28, 175)]),
               ((158, 140),
                (138, 150),
                (88, 158),
                [(111, 157, 139, 181), (108, 155, 130, 181)],
                [(58, 164, 31, 175), (55, 165, 28, 177)])],
 'jalon': [((96, 83),
            (96, 107),
            (96, 149),
            [(66, 78, 57, 52), (126, 78, 135, 52)],
            [(69, 154, 65, 179), (122, 154, 127, 179)]),
           ((96, 83),
            (96, 107),
            (96, 149),
            [(65, 124, 57, 98), (127, 124, 135, 98)],
            [(69, 154, 65, 179), (122, 154, 127, 179)])],
 'prensa': [((49, 120),
             (64, 135),
             (86, 167),
             [(75, 156, 70, 169), (79, 154, 75, 167)],
             [(91, 122, 129, 132), (97, 124, 135, 134)]),
            ((49, 120),
             (64, 135),
             (86, 167),
             [(75, 156, 70, 169), (79, 154, 75, 167)],
             [(117, 141, 158, 113), (113, 138, 152, 109)])],
 'press-militar': [((95, 64),
                    (95, 90),
                    (95, 128),
                    [(63, 100, 64, 76), (127, 100, 127, 76)],
                    [(82, 154, 78, 181), (109, 154, 113, 181)]),
                   ((95, 64),
                    (95, 90),
                    (95, 128),
                    [(69, 66, 69, 37), (121, 66, 121, 37)],
                    [(82, 154, 78, 181), (109, 154, 113, 181)])],
 'remo-mancuerna': [((144, 83),
                     (125, 100),
                     (74, 110),
                     [(147, 118, 147, 143), (120, 128, 117, 159)],
                     [(76, 142, 43, 143), (85, 151, 78, 181)]),
                    ((144, 83),
                     (125, 100),
                     (74, 110),
                     [(147, 118, 147, 143), (95, 89, 92, 121)],
                     [(76, 142, 43, 143), (85, 151, 78, 181)])],
 'remo-polea': [((53, 63),
                 (50, 90),
                 (48, 134),
                 [(79, 103, 111, 103), (77, 109, 108, 108)],
                 [(91, 136, 139, 164), (87, 137, 135, 168)]),
                ((53, 63),
                 (50, 90),
                 (48, 134),
                 [(34, 115, 65, 114), (29, 114, 60, 111)],
                 [(91, 136, 139, 164), (87, 137, 135, 168)])],
 'sentadilla-libre': [((100, 53),
                       (93, 78),
                       (89, 119),
                       [(104, 106, 121, 116), (100, 111, 113, 124)],
                       [(99, 151, 101, 181), (89, 151, 88, 181)]),
                      ((114, 86),
                       (101, 109),
                       (64, 143),
                       [(130, 116, 151, 114), (122, 119, 146, 120)],
                       [(114, 145, 102, 181), (105, 145, 90, 181)])],
 'tobillo-pared': [((104, 63),
                    (98, 87),
                    (76, 127),
                    [(123, 99, 157, 97), (124, 106, 157, 106)],
                    [(112, 134, 112, 178), (54, 153, 43, 181)]),
                   ((117, 65),
                    (110, 88),
                    (87, 128),
                    [(133, 104, 157, 97), (130, 110, 157, 106)],
                    [(140, 141, 112, 178), (66, 153, 43, 181)])],
 'triceps-polea': [((76, 62),
                    (74, 86),
                    (67, 127),
                    [(82, 116, 110, 105), (75, 117, 105, 110)],
                    [(67, 153, 68, 181), (78, 152, 86, 181)]),
                   ((76, 62),
                    (74, 86),
                    (67, 127),
                    [(82, 116, 88, 146), (75, 117, 81, 143)],
                    [(67, 153, 68, 181), (78, 152, 86, 181)])]})

CAPTIONS.update({'abdominal-corto': ('Pies en el suelo', 'Eleva los hombros'),
 'banca-barra': ('Baja hacia el pecho', 'Empuja la barra'),
 'curl-femoral': ('Rodillo por detrás', 'Baja los talones'),
 'curl-mancuerna': ('Brazos abajo', 'Flexiona los codos'),
 'dead-bug': ('Brazos y piernas arriba', 'Extiende lados opuestos'),
 'elevacion-lateral': ('Cargas a los lados', 'Eleva a los lados'),
 'extension-rodilla': ('Rodillo por delante', 'Estira las rodillas'),
 'flexiones': ('Cuerpo alineado', 'Acerca el pecho'),
 'jalon': ('Agarre arriba', 'Barra frente al pecho'),
 'prensa': ('Flexiona con control', 'Empuja la plataforma'),
 'press-militar': ('Carga a los hombros', 'Empuja hacia arriba'),
 'remo-mancuerna': ('Mano y rodilla en banco', 'Codo hacia la cadera'),
 'remo-polea': ('Brazos al frente', 'Tira hacia el abdomen'),
 'sentadilla-libre': ('Pies firmes', 'Flexiona y sube'),
 'tobillo-pared': ('Talón apoyado', 'Rodilla hacia la pared'),
 'triceps-polea': ('Codos al costado', 'Empuja hacia abajo')})

MOTION.update({'abdominal-corto': (None, (27, 170, 18, 149, 29, 138)),
 'banca-barra': (None, (92, 91, 100, 70, 97, 51)),
 'curl-femoral': (None, (154, 146, 147, 167, 126, 173)),
 'curl-mancuerna': (None, (145, 135, 158, 109, 146, 91)),
 'dead-bug': (None, (126, 147, 145, 145, 162, 153)),
 'elevacion-lateral': (None, (145, 136, 163, 116, 166, 104)),
 'extension-rodilla': (None, (129, 167, 159, 157, 160, 143)),
 'flexiones': (None, (166, 112, 173, 121, 169, 139)),
 'jalon': (None, (154, 63, 160, 77, 150, 96)),
 'prensa': (None, (119, 110, 135, 96, 151, 96)),
 'press-militar': (None, (148, 75, 156, 53, 145, 36)),
 'remo-mancuerna': (None, (67, 151, 55, 124, 71, 108)),
 'remo-polea': (None, (108, 88, 93, 83, 76, 89)),
 'sentadilla-libre': (None, (42, 92, 36, 118, 44, 137)),
 'tobillo-pared': (None, (123, 123, 137, 114, 150, 122)),
 'triceps-polea': (None, (111, 112, 119, 128, 111, 145))})

GYM_EQUIPMENT = {'abdominal-corto': ([('mat', 'M15 185h150')], [('mat', 'M15 185h150')]),
 'banca-barra': ([('machine', 'M22 127h98m-84 2v55m70-55v55 M19 184V65h13'),
                  ('bar', 'M42 100h43'),
                  ('plates', 'M46 91v18M82 91v18')],
                 [('machine', 'M22 127h98m-84 2v55m70-55v55 M19 184V65h13'),
                  ('bar', 'M39 52h43'),
                  ('plates', 'M43 43v18M79 43v18')]),
 'curl-femoral': ([('machine', 'M54 86l10 48h55m-52 1v49m50-51v51 M118 129l39 10'),
                   ('weight', 'M106 120h21m22 19h14')],
                  [('machine', 'M54 86l10 48h55m-52 1v49m50-51v51 M118 129l-12 44'),
                   ('weight', 'M106 120h21m-25 52h13')]),
 'curl-mancuerna': ([('dumbbell', 'M56 137h18m-16-5v10m14-10v10m43-5h18m-16-5v10m14-10v10')],
                    [('dumbbell', 'M56 84h18m-16-5v10m14-10v10m43-5h18m-16-5v10m14-10v10')]),
 'dead-bug': ([('mat', 'M11 183h157')], [('mat', 'M11 183h157')]),
 'elevacion-lateral': ([('dumbbell', 'M54 137h18m-16-5v10m14-10v10m48-5h18m-16-5v10m14-10v10')],
                       [('dumbbell', 'M18 89h18m-16-5v10m14-10v10m120-5h18m-16-5v10m14-10v10')]),
 'extension-rodilla': ([('machine', 'M54 86l10 48h55m-52 1v49m50-51v51 M118 129l10 43'),
                        ('weight', 'M118 173h16')],
                       [('machine', 'M54 86l10 48h55m-52 1v49m50-51v51 M118 129l45 9'),
                        ('weight', 'M158 137h10')]),
 'jalon': ([('machine', 'M40 184V28h56 M70 162h52m-26 1v21'),
            ('weight', 'M62 147H130'),
            ('bar', 'M55 52h83'),
            ('cable', 'M96 28v24')],
           [('machine', 'M40 184V28h56 M70 162h52m-26 1v21'),
            ('weight', 'M62 147H130'),
            ('bar', 'M55 98h83'),
            ('cable', 'M96 28v70')]),
 'prensa': ([('machine', 'M37 178H164 M40 129 84 169h18 M99 181 172 111 M90 173 163 103'),
             ('platform', 'M124 141l21-32 6 4-21 32Z')],
            [('machine', 'M37 178H164 M40 129 84 169h18 M99 181 172 111 M90 173 163 103'),
             ('platform', 'M149 120l21-32 6 4-21 32Z')]),
 'press-militar': ([('dumbbell', 'M55 76h18m-16-5v10m14-10v10m47-5h18m-16-5v10m14-10v10')],
                   [('dumbbell', 'M60 37h18m-16-5v10m14-10v10m36-5h18m-16-5v10m14-10v10')]),
 'remo-mancuerna': ([('machine', 'M37 146h122m-114 2v36m104-36v36'),
                     ('dumbbell', 'M109 159h16m-15-4v8m14-8v8')],
                    [('machine', 'M37 146h122m-114 2v36m104-36v36'),
                     ('dumbbell', 'M84 121h16m-15-4v8m14-8v8')]),
 'remo-polea': ([('machine', 'M31 145h49m-35 0v39M155 169l-16-6 9-23m17 43v-64h13v64'),
                 ('cable', 'M167 109 111 104')],
                [('machine', 'M31 145h49m-35 0v39M155 169l-16-6 9-23m17 43v-64h13v64'),
                 ('cable', 'M167 109 63 113')]),
 'tobillo-pared': ([('machine', 'M161 66v117')], [('machine', 'M161 66v117')]),
 'triceps-polea': ([('machine', 'M151 183V39h-23'), ('cable', 'M128 39 109 105'), ('bar', 'M99 108h17')],
                   [('machine', 'M151 183V39h-23'), ('cable', 'M128 39 86 144'), ('bar', 'M76 145h20')])}

ART = '''  <style>
    .panel{fill:#f0f7f6;stroke:#c1d5d3}
    .ground{stroke:#afc6c6;stroke-width:1.5;stroke-dasharray:3 4}
    .limb,.torso,.shoulders,.neck,.shoe,.band,.support,.weight,.motion{
      fill:none;stroke-linecap:round;stroke-linejoin:round
    }
    .limb{stroke-width:9}
    .far{stroke:#597886}
    .near,.neck,.shoe{stroke:#163542}
    .torso{stroke:#137d72;stroke-width:19}
    .shoulders{stroke:#137d72;stroke-width:12}
    .neck,.shoe{stroke-width:7}
    .head{fill:#163542}
    .band,.weight{stroke:#965018;stroke-width:3.5}
    .support{stroke:#557783;stroke-width:5}
    .machine,.bar,.plates,.cable,.dumbbell,.mat{
      fill:none;stroke-linecap:round;stroke-linejoin:round
    }
    .machine{stroke:#607e87;stroke-width:4}
    .cable{stroke:#607e87;stroke-width:2}
    .bar,.plates,.dumbbell{stroke:#81431a;stroke-width:4}
    .mat{stroke:#8cb8b1;stroke-width:4}
    .platform{fill:#c3d8d6;stroke:#557783;stroke-width:2.5}
    .motion{stroke:#9b4919;stroke-width:2.8;stroke-dasharray:2 4}
    .motion-tip{fill:#9b4919}
    .caption{font:650 13px system-ui,sans-serif;fill:#163542}
    .step{fill:#d6e9e6}
    .step-text{font:700 10px system-ui,sans-serif;fill:#20524c}
  </style>'''

ASSETS = Path(__file__).resolve().parents[1] / 'public' / 'exercises'


def chain(start, limb):
    x, y = start
    joint_x, joint_y, end_x, end_y = limb
    return f'M{x} {y} {joint_x} {joint_y} {end_x} {end_y}'


def motion_curve(points):
    x, y, control_x, control_y, tip_x, tip_y = points
    angle = atan2(tip_y - control_y, tip_x - control_x)
    corners = [
        (tip_x - 8 * cos(angle + offset), tip_y - 8 * sin(angle + offset))
        for offset in (-0.46, 0.46)
    ]
    tip = f'{tip_x},{tip_y} ' + ' '.join(f'{a:.1f},{b:.1f}' for a, b in corners)
    return (f'<path class="motion" d="M{x} {y} Q{control_x} {control_y} {tip_x} {tip_y}"/>'
            f'<polygon class="motion-tip" points="{tip}"/>')


def equipment_path(key, index):
    frames = EQUIPMENT.get(key)
    if not frames:
        return ''
    kind, path = frames[index]
    return f'<path class="{kind}" d="{path}"/>'


def figure(key, index, pose):
    head, shoulder, hip, arms, legs = pose
    head_x, head_y = head
    shoulder_x, shoulder_y = shoulder
    hip_x, hip_y = hip
    front = key in {'apertura-banda', 'curl-banda', 'press-banda', 'rotacion-banda', 'hombro', 'salto', 'equilibrio',
                    'jalon', 'press-militar', 'elevacion-lateral', 'curl-mancuerna'}
    shoulder_offset = 10 if front else 0
    hip_offset = 6 if front else 0
    left_shoulder = (shoulder_x - shoulder_offset, shoulder_y)
    right_shoulder = (shoulder_x + shoulder_offset, shoulder_y)
    left_hip = (hip_x - hip_offset, hip_y)
    right_hip = (hip_x + hip_offset, hip_y)
    shoulders = f'<path class="shoulders" d="M{left_shoulder[0]} {shoulder_y}H{right_shoulder[0]}"/>' if front else ''
    prop = equipment_path(key, index)
    foreground = ''
    gym_frames = GYM_EQUIPMENT.get(key)
    if gym_frames:
        for kind, path in gym_frames[index]:
            markup = f'<path class="{kind}" d="{path}"/>'
            if kind in {'machine', 'mat', 'platform'}:
                prop += markup
            else:
                foreground += markup
    if key in {'apertura-banda', 'rotacion-banda', 'hombro'}:
        foreground, prop = prop, ''
    steps = MOTION.get(key)
    arrow = motion_curve(steps[index]) if steps and steps[index] else ''
    weights = WEIGHTS.get(key)
    weight = f'<path class="weight" d="{weights[index]}"/>' if weights else ''
    shoes = []
    for index, (_, _, foot_x, foot_y) in enumerate(legs):
        if foot_y >= 145:
            direction = -1 if (front and index == 0) or key in {'plancha', 'lateral', 'nordico'} else 1
            toe_x = foot_x + 8 * direction
            toe_y = max(foot_y, 178) if key == 'talones' else foot_y
            shoes.append(f'<path class="shoe" d="M{foot_x} {foot_y} {toe_x} {toe_y}"/>')

    return f'''      {prop}
      <path class="limb far" d="{chain(left_shoulder, arms[0])} {chain(left_hip, legs[0])}"/>
      <path class="neck" d="M{head_x} {head_y} {shoulder_x} {shoulder_y}"/>
      <path class="torso" d="M{shoulder_x} {shoulder_y} {hip_x} {hip_y}"/>
      {shoulders}
      <path class="limb near" d="{chain(right_shoulder, arms[1])} {chain(right_hip, legs[1])}"/>
      {''.join(shoes)}
      <circle class="head" cx="{head_x}" cy="{head_y}" r="10"/>
      {foreground}{weight}{arrow}'''


def render(key):
    poses = POSES[key]
    width = 216 * len(poses)
    panels = []
    for i, (pose, caption) in enumerate(zip(poses, CAPTIONS[key], strict=True)):
        panels.append(f'''  <g transform="translate({i * 216} 0)">
    <rect class="panel" x="3" y="3" width="210" height="204" rx="14"/>
    <path class="ground" d="M19 162H197"/>
    <g transform="translate(27 2) scale(.85)">
{figure(key, i, pose)}
    </g>
    <rect class="step" x="15" y="178" width="19" height="17" rx="5"/>
    <text class="step-text" x="24.5" y="190" text-anchor="middle">{i + 1}</text>
    <text class="caption" x="44" y="191">{escape(caption)}</text>
  </g>''')
    return '\n'.join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 210">',
        ART, *panels, '</svg>', '',
    ])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    differences = []
    for key in POSES:
        path = ASSETS / f'{key}.svg'
        content = render(key)
        if not args.check:
            path.write_text(content, encoding='utf8')
        elif not path.exists() or path.read_text(encoding='utf8') != content:
            differences.append(path.name)

    if differences:
        parser.exit(1, 'SVG fuera de fecha: ' + ', '.join(differences) + '\n')


if __name__ == '__main__':
    main()
