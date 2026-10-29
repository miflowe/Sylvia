# Sprout plant-ID accuracy test

Run 2026-10-28 (Toronto time) against the live app (https://ca-web-6x6suo5lxjc5o.icysmoke-e61b83ec.canadacentral.azurecontainerapps.io), with `node scripts/plant-accuracy.mjs`.

## Result

| Measure | Result |
| --- | --- |
| Photos / species | 48 / 16 (3 per species, Ontario and BC lists) |
| Right species as the top answer (top-1) | **83%** (40 of 48) |
| Right species among the top 3 (top-3) | **94%** (45 of 48) |
| Answers Sprout gave as "Sure" (no confirm prompt) | 30 of 48, right 97% of the time |
| Photos where Sprout asked the person to confirm | 38% |
| Regional verdict (invasive / native) right | 88% |
| Median time per photo | 5.9 s |
| By region, top-1 | Ontario 81% (27 photos), BC 86% (21 photos) |

## Method

- Photos: research-grade iNaturalist observations from Canada with CC0, CC BY or CC BY-NC licences, most-voted first,
  one photo per observer, 500 px "medium" size. Every species on Sprout's curated Ontario and BC lists.
- Each photo goes through the real `/api/sprout` endpoint (gpt-4o in Azure AI Foundry plus Pl@ntNet, merged), in
  the region whose list carries the species. Scored on the species name; accepted synonyms count (Berberis
  aquifolium = Mahonia aquifolium).
- Photos stay out of the repo. Per-photo results, with credits, are in `plant-id-accuracy.json`.

## By species

| Species | Region | Top-1 | Top-3 | Wrong top answers |
| --- | --- | --- | --- | --- |
| *Berberis thunbergii* | ON | 3/3 | 3/3 |  |
| *Euonymus alatus* | ON | 2/3 | 3/3 | Berberis thunbergii |
| *Vinca minor* | ON | 3/3 | 3/3 |  |
| *Phragmites australis subsp. australis* | ON | 3/3 | 3/3 |  |
| *Acer platanoides* | ON | 0/3 | 3/3 | Acer saccharum; Acer rubrum; Acer rubrum |
| *Cytisus scoparius* | BC | 2/3 | 2/3 | Pseudevernia furfuracea |
| *Hedera helix* | BC | 3/3 | 3/3 |  |
| *Rubus armeniacus* | BC | 3/3 | 3/3 |  |
| *Physocarpus opulifolius* | ON | 3/3 | 3/3 |  |
| *Aronia melanocarpa* | ON | 2/3 | 2/3 | Prunus serotina |
| *Asarum canadense* | ON | 3/3 | 3/3 |  |
| *Acer rubrum* | ON | 3/3 | 3/3 |  |
| *Arctostaphylos uva-ursi* | BC | 2/3 | 2/3 | (not a plant) |
| *Rubus parviflorus* | BC | 3/3 | 3/3 |  |
| *Physocarpus capitatus* | BC | 2/3 | 3/3 | Rubus parviflorus |
| *Mahonia aquifolium* | BC | 3/3 | 3/3 |  |

## What the misses show

- **Norway maple is the weak spot (0 of 3 top-1).** It was taken for native maples (sugar and red maple), once with
  high confidence from a bare winter twig. Because red maple is native, that photo got a "native" verdict for an
  invasive tree. A fix to consider: when an invasive and a native species of the same genus are both candidates,
  always ask the person to confirm.
- Hard photos explain the other misses: a frost-covered broom seedling (read as a lichen), a black bear standing in
  kinnikinnick (read as "not a plant"), and a black chokeberry taken for black cherry.
- When Sprout was unsure it said so: it asked the person to confirm on 38% of photos, and the right
  species was in its top 3 for 94% overall.

## Photo credits

- berberis-thunbergii-1.jpg: [observation](https://www.inaturalist.org/observations/191998274) by gary-james, CC-BY-NC
- berberis-thunbergii-2.jpg: [observation](https://www.inaturalist.org/observations/63070330) by lhp2, CC-BY-NC
- berberis-thunbergii-3.jpg: [observation](https://www.inaturalist.org/observations/169183939) by ecologyrockstar, CC-BY-NC
- euonymus-alatus-1.jpg: [observation](https://www.inaturalist.org/observations/325588630) by pdabell, CC-BY-NC
- euonymus-alatus-2.jpg: [observation](https://www.inaturalist.org/observations/188614577) by mhalsted, CC-BY-NC
- euonymus-alatus-3.jpg: [observation](https://www.inaturalist.org/observations/143820207) by laurenmanary, CC-BY-NC
- vinca-minor-1.jpg: [observation](https://www.inaturalist.org/observations/248779098) by benmulch9, CC-BY-NC
- vinca-minor-2.jpg: [observation](https://www.inaturalist.org/observations/24833270) by acirtwill, CC-BY-NC
- vinca-minor-3.jpg: [observation](https://www.inaturalist.org/observations/347894707) by charliekassissieh, CC-BY-NC
- phragmites-australis-subsp-australis-1.jpg: [observation](https://www.inaturalist.org/observations/141454532) by patkramer, CC-BY-NC
- phragmites-australis-subsp-australis-2.jpg: [observation](https://www.inaturalist.org/observations/188538866) by data_nerd, CC-BY
- phragmites-australis-subsp-australis-3.jpg: [observation](https://www.inaturalist.org/observations/123165150) by tarra, CC-BY-NC
- acer-platanoides-1.jpg: [observation](https://www.inaturalist.org/observations/190504234) by daynanyagat, CC-BY-NC
- acer-platanoides-2.jpg: [observation](https://www.inaturalist.org/observations/94068804) by natrudkins, CC-BY-NC
- acer-platanoides-3.jpg: [observation](https://www.inaturalist.org/observations/19187067) by owenclarkin, CC-BY-NC
- cytisus-scoparius-1.jpg: [observation](https://www.inaturalist.org/observations/78018960) by shanebustapbj, CC0
- cytisus-scoparius-2.jpg: [observation](https://www.inaturalist.org/observations/269351908) by artemiza, CC-BY-NC
- cytisus-scoparius-3.jpg: [observation](https://www.inaturalist.org/observations/61272351) by nikki_laine, CC-BY-NC
- hedera-helix-1.jpg: [observation](https://www.inaturalist.org/observations/45182570) by calypso4, CC-BY-NC
- hedera-helix-2.jpg: [observation](https://www.inaturalist.org/observations/22642325) by katlmartin, CC-BY-NC
- hedera-helix-3.jpg: [observation](https://www.inaturalist.org/observations/247225385) by drclements, CC-BY-NC
- rubus-armeniacus-1.jpg: [observation](https://www.inaturalist.org/observations/15830089) by piklishi, CC-BY-NC
- rubus-armeniacus-2.jpg: [observation](https://www.inaturalist.org/observations/87934464) by timothycai, CC-BY-NC
- rubus-armeniacus-3.jpg: [observation](https://www.inaturalist.org/observations/382765377) by elsemikkelsen, CC-BY-NC
- physocarpus-opulifolius-1.jpg: [observation](https://www.inaturalist.org/observations/35428331) by celia_ben, CC-BY-NC
- physocarpus-opulifolius-2.jpg: [observation](https://www.inaturalist.org/observations/64019708) by marieleeaudet, CC-BY-NC
- physocarpus-opulifolius-3.jpg: [observation](https://www.inaturalist.org/observations/317548535) by noemiem, CC-BY-NC
- aronia-melanocarpa-1.jpg: [observation](https://www.inaturalist.org/observations/49645686) by keevilm, CC-BY-NC
- aronia-melanocarpa-2.jpg: [observation](https://www.inaturalist.org/observations/31352625) by reneegmc, CC-BY-NC
- aronia-melanocarpa-3.jpg: [observation](https://www.inaturalist.org/observations/317416893) by simard_m, CC-BY-NC
- asarum-canadense-1.jpg: [observation](https://www.inaturalist.org/observations/162804894) by rostyslav_yurechko, CC-BY
- asarum-canadense-2.jpg: [observation](https://www.inaturalist.org/observations/193949496) by tinhen, CC-BY-NC
- asarum-canadense-3.jpg: [observation](https://www.inaturalist.org/observations/191242514) by lhp2, CC-BY-NC
- acer-rubrum-1.jpg: [observation](https://www.inaturalist.org/observations/21891310) by owenclarkin, CC-BY-NC
- acer-rubrum-2.jpg: [observation](https://www.inaturalist.org/observations/137233040) by mhalsted, CC-BY-NC
- acer-rubrum-3.jpg: [observation](https://www.inaturalist.org/observations/356956486) by chasseurdeplantes, CC-BY-NC
- arctostaphylos-uva-ursi-1.jpg: [observation](https://www.inaturalist.org/observations/33600072) by sydcannings, CC-BY
- arctostaphylos-uva-ursi-2.jpg: [observation](https://www.inaturalist.org/observations/6076828) by christine123, CC-BY
- arctostaphylos-uva-ursi-3.jpg: [observation](https://www.inaturalist.org/observations/31644878) by jasonheadley, CC-BY-NC
- rubus-parviflorus-1.jpg: [observation](https://www.inaturalist.org/observations/168419885) by nicolashoude, CC-BY-NC
- rubus-parviflorus-2.jpg: [observation](https://www.inaturalist.org/observations/295025966) by joanseptembre, CC-BY-NC
- rubus-parviflorus-3.jpg: [observation](https://www.inaturalist.org/observations/284898362) by karenslens, CC-BY-NC
- physocarpus-capitatus-1.jpg: [observation](https://www.inaturalist.org/observations/217233815) by leewarren, CC-BY-NC
- physocarpus-capitatus-2.jpg: [observation](https://www.inaturalist.org/observations/212030634) by brook07, CC-BY-NC
- physocarpus-capitatus-3.jpg: [observation](https://www.inaturalist.org/observations/212088821) by champagnejain, CC-BY-NC
- mahonia-aquifolium-1.jpg: [observation](https://www.inaturalist.org/observations/38618498) by lesfreck, CC-BY-NC
- mahonia-aquifolium-2.jpg: [observation](https://www.inaturalist.org/observations/192700719) by beast_mode, CC-BY-NC
- mahonia-aquifolium-3.jpg: [observation](https://www.inaturalist.org/observations/129768336) by jbindernagel, CC-BY-NC
