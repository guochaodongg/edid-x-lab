/* ==========================================================================
   EDID-X-LAB — edid-core.js
   Shared constants, byte helpers and lookup tables.
   Zero dependencies (classic script, no modules).
   ========================================================================== */
(function (global) {
  'use strict';

  var HEADER = [0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00];
  var BLOCK_SIZE = 128;
  var MAX_BLOCKS = 256;

  /* ---------------------------------------------------------------- EISA ID */
  /* PNP/EISA manufacturer identifiers used by EDID (compressed 3-letter code). */
  var EISA = {
    AAA: 'Avolites', AAB: 'Aurora', AAC: 'Apple', AAD: 'Aashima', AAE: 'AESC',
    AAF: 'Achme', AAH: 'Aksys', AAK: 'Anam', AAM: 'Acer America', AAN: 'AcerNet',
    AAO: 'Acer Peripherals', AAP: 'Ace CAD', AAR: 'Aardvark', AAS: 'Abit',
    AAT: 'Alcatel', AAV: 'Alps', AAW: 'Aries', AAX: 'Acutex', ABA: 'AboCom',
    ABB: 'ABB', ABC: 'Aptor', ABD: 'Abit (ABD)', ABO: 'AboCom', ABS: 'Absolut',
    ABU: 'Abus', ACC: 'Accton', ACD: 'Acer Display', ACE: 'Acer Peripherals',
    ACI: 'Ancor', ACL: 'Acroloop', ACO: 'Allion', ACP: 'Acrop', ACR: 'Acer',
    ACS: 'Acer', ACT: 'Action', ACU: 'AcuLab', ADA: 'Adax', ADI: 'ADI Systems',
    ADM: 'Adicom', ADN: 'Adic', ADO: 'Adi', ADP: 'Adaptec', ADR: 'Adara',
    ADS: 'ADS Technologies', ADT: 'Advanced Display', ADX: 'Addex', AEC: 'Aeco',
    AEG: 'AEG', AEO: 'Aeolus', AER: 'Aerial', AES: 'Applied Expert',
    AET: 'Aetech', AFG: 'AFG', AGI: 'Agency', AGM: 'Algol', AGX: 'Agile',
    AHC: 'Ahead', AHI: 'Ahead', AIC: 'ArchiTech', AIM: 'AIMS Lab',
    AIR: 'Airwell', AIT: 'AIT', AIW: 'Aiwa', AKA: 'Aksys', AKB: 'Akebia',
    AKE: 'Acer Peripherals', AKL: 'Acer Labs', ALC: 'Alcatel', ALD: 'Aldebaran',
    ALG: 'Algol', ALL: 'Alliance', ALN: 'Alnair', ALP: 'Alps', ALR: 'ALR',
    ALS: 'Alsys', ALT: 'Altos', ALU: 'Aluar', ALX: 'Altex', AMD: 'Amdek',
    AMI: 'American Megatrends', AML: 'Amulet', AMP: 'Amptron', AMT: 'AMT',
    ANC: 'Ancor', AND: 'Andor', ANI: 'Anigma', ANL: 'Analog Devices',
    ANO: 'Anorad', ANS: 'Answer', ANT: 'Antex', AOC: 'AOC', AOE: 'AOEnet',
    AOL: 'AOL', AOI: 'AOI', AOS: 'AOS', APD: 'Applied Digital',
    APC: 'American Power', APE: 'Applied Engineering', APP: 'Appian',
    APR: 'April', APX: 'Apex', AQT: 'Acquit', AQU: 'Aquila',
    ARB: 'Arbor', ARC: 'Archtek', ARE: 'Ares', ARG: 'Argosy',
    ARI: 'Argus', ARK: 'Ark', ARL: 'Arco', ARM: 'Acer Peripherals',
    ARN: 'Arnos', ARP: 'Alpha', ARS: 'Artis', ART: 'ArtMedia',
    ARV: 'Arvida', ASB: 'Asahi', ASC: 'Ascom', ASD: 'ASD',
    ASE: 'Ase', ASG: 'Asg', ASH: 'Ashton', ASI: 'ASI',
    ASK: 'Askey', ASL: 'Asanti', ASM: 'ASEM', ASN: 'Asante',
    ASO: 'Asoka', ASP: 'ASP', ASR: 'ASRock', AST: 'AST Research',
    ASU: 'Asus', ASX: 'AST', ATI: 'ATI Technologies', ATL: 'Atlas',
    ATM: 'Atmel', ATN: 'Athena', ATT: 'AT&T', ATV: 'ATI',
    ATX: 'Atx', AUC: 'Audiocodes', AUI: 'Audi', AUR: 'Aureal',
    AUS: 'ASUSTeK', AUT: 'Autodesk', AUX: 'Aux', AVC: 'AVID',
    AVI: 'Avi', AVN: 'Avance', AVO: 'Avocent', AVR: 'Avril',
    AVS: 'Avid', AWA: 'Award', AXB: 'Axtel', AXC: 'Axc',
    AXI: 'Axiom', AXP: 'Axper', AXT: 'AXT', BAN: 'BancTec',
    BBB: 'Bitboys', BBH: 'Bullet', BCS: 'BCS', BDS: 'Barco',
    BEC: 'Beckhoff', BEL: 'Belkin', BEO: 'Bang & Olufsen',
    BFO: 'Buffalo', BGT: 'BGT', BIB: 'Bib', BIL: 'Bilen',
    BIO: 'Biodata', BIT: 'Bit', BLI: 'Blitz', BLU: 'Blu-ray',
    BMC: 'BMC', BMI: 'BMI', BNE: 'Bne', BNK: 'Bank',
    BNO: 'Bang & Olufsen', BNT: 'Bint', BOC: 'Boca', BOR: 'Borland',
    BOS: 'BOS', BPD: 'BPD', BPS: 'Barco', BRC: 'Brick',
    BRN: 'Brunei', BRS: 'Brass', BSC: 'BSC', BSE: 'Base',
    BST: 'BST', BTC: 'BTC', BTE: 'Bte', BTK: 'Bitko',
    BUF: 'Buffalo', BUS: 'BusLogic', BVI: 'BVI', BWK: 'Bewan',
    BXC: 'Box', CAC: 'Cache', CAI: 'Cai', CAL: 'CalComp',
    CAN: 'Canon', CAP: 'Cap', CAR: 'Card', CAS: 'Casio',
    CAT: 'Cat', CAV: 'Cavium', CBI: 'CBI', CBS: 'CBS',
    CCC: 'C-Cube', CCI: 'CCI', CCP: 'CCP', CCS: 'CCS',
    CDT: 'Corect', CEC: 'CEC', CED: 'Ced', CEL: 'Celestica',
    CEN: 'Century', CEO: 'Ceo', CGS: 'Chips & Technologies',
    CHE: 'Che', CHI: 'Chic', CHL: 'Chloride', CHM: 'Chimei',
    CHP: 'Chip', CHR: 'Christie', CHT: 'Chat', CIA: 'CIA',
    CIE: 'Cie', CIN: 'Cin', CIR: 'Cirrus', CIS: 'Cisco',
    CIT: 'Citizen', CLC: 'CL', CLD: 'Cloud', CLE: 'Cle',
    CLG: 'Clipper', CLI: 'Clientron', CLM: 'Clm', CLO: 'Clone',
    CLR: 'Color', CLT: 'Clear', CLV: 'Clover', CMA: 'Cma',
    CMD: 'CMD Technology', CMI: 'C-Media', CMM: 'Compaq',
    CMP: 'Compaq', CMS: 'CMS', CMT: 'Comtrol', CNB: 'Canon',
    CNC: 'Canon', CNE: 'Cnet', CNI: 'CNI', CNM: 'Canon',
    CNN: 'Canon', CNT: 'Centon', CNX: 'Conexant', COB: 'Cobalt',
    COD: 'Code', COG: 'Cogent', COI: 'Coin', COL: 'Colorgraphic',
    COM: 'Comtrol', CON: 'Contec', COO: 'Cool', COR: 'Cordata',
    COS: 'Costar', COW: 'Cow', CPQ: 'Compaq', CPS: 'CPS',
    CPT: 'Capetronic', CPU: 'CPU', CRC: 'Crel', CRD: 'Cardinal',
    CRF: 'Craftsman', CRO: 'Crown', CRT: 'CRT', CRV: 'Corvus',
    CRW: 'Crown', CSA: 'Csa', CSC: 'CSC', CSI: 'CSI',
    CSM: 'CSM', CSN: 'Cascade', CST: 'CST', CTC: 'CTC',
    CTI: 'Cti', CTL: 'Creative', CTN: 'Ctn', CTR: 'Ctr',
    CTX: 'CTX', CUB: 'Cube', CUI: 'Cui', CUR: 'Cursor',
    CVL: 'Cvl', CVR: 'Cvr', CVT: 'CVT', CWR: 'Cwr',
    CXT: 'Cxt', CYB: 'Cyber', CYC: 'Cyclone', CYD: 'Cyd',
    CYT: 'Cyrix', DAE: 'Daewoo', DAJ: 'Daj', DAN: 'Dan',
    DAS: 'Das', DAT: 'Dat', DAV: 'Dave', DAW: 'Daw',
    DBB: 'DBB', DBM: 'DBM', DBT: 'DBT', DCC: 'DCC',
    DCE: 'Dce', DCI: 'Dci', DCL: 'Dcl', DCM: 'Dcm',
    DCO: 'Dco', DCS: 'Dcs', DCT: 'Dct', DCV: 'Dcv',
    DCX: 'Dcx', DDA: 'Dda', DDC: 'DDC', DDE: 'Dde',
    DDG: 'Ddg', DDL: 'Ddl', DDN: 'Ddn', DDO: 'Ddo',
    DDS: 'Dds', DDT: 'Ddt', DDX: 'Ddx', DEC: 'Digital Equipment',
    DEL: 'Dell', DEM: 'Dem', DEN: 'Den', DET: 'Det',
    DEV: 'Dev', DFI: 'DFI', DFK: 'Dfk', DGC: 'Dgc',
    DGE: 'Dge', DGI: 'Dgi', DGP: 'Dgp', DGT: 'Dgt',
    DHP: 'Dhp', DIA: 'Dia', DIC: 'Dic', DID: 'Did',
    DIE: 'Die', DIG: 'Dig', DII: 'Dii', DIL: 'Dil',
    DIM: 'Dim', DIN: 'Din', DIO: 'Dio', DIP: 'Dip',
    DIR: 'Dir', DIS: 'Dis', DIT: 'Dit', DIV: 'Div',
    DIX: 'Dix', DIY: 'Diy', DLC: 'Dlc', DLE: 'Dle',
    DLG: 'Dlg', DLL: 'Dll', DLM: 'Dlm', DLO: 'Dlo',
    DLS: 'Dls', DLT: 'Dlt', DLX: 'Dlx', DMA: 'Dma',
    DMB: 'Dmb', DMC: 'Dmc', DMD: 'Dmd', DME: 'Dme',
    DMI: 'Dmi', DML: 'Dml', DMM: 'Dmm', DMN: 'Dmn',
    DMO: 'Dmo', DMP: 'Dmp', DMR: 'Dmr', DMS: 'Dms',
    DMT: 'Dmt', DMV: 'Dmv', DMX: 'Dmx', DNA: 'Dna',
    DNC: 'Dnc', DNE: 'Dne', DNI: 'Dni', DNK: 'Dnk',
    DNM: 'Dnm', DNN: 'Dnn', DNO: 'Dno', DNP: 'Dnp',
    DNR: 'Dnr', DNS: 'Dns', DNT: 'Dnt', DNV: 'Dnv',
    DNX: 'Dnx', DOB: 'Dob', DOC: 'Doc', DOE: 'Doe',
    DOG: 'Dog', DOI: 'Doi', DOL: 'Dol', DOM: 'Dom',
    DON: 'Don', DOO: 'Doo', DOP: 'Dop', DOR: 'Dor',
    DOS: 'Dos', DOT: 'Dot', DOV: 'Dov', DOW: 'Dow',
    DPB: 'Dpb', DPC: 'Dpc', DPD: 'Dpd', DPE: 'Dpe',
    DPG: 'Dpg', DPH: 'Dph', DPI: 'Dpi', DPJ: 'Dpj',
    DPK: 'Dpk', DPL: 'Dpl', DPM: 'Dpm', DPN: 'Dpn',
    DPO: 'Dpo', DPP: 'Dpp', DPR: 'Dpr', DPS: 'Dps',
    DPT: 'Dpt', DPV: 'Dpv', DPW: 'Dpw', DPX: 'Dpx',
    DPY: 'Dpy', DPZ: 'Dpz', DQB: 'Dqb', DQC: 'Dqc',
    DQE: 'Dqe', DQF: 'Dqf', DQG: 'Dqg', DQH: 'Dqh',
    DQI: 'Dqi', DQL: 'Dql', DQM: 'Dqm', DQN: 'Dqn',
    DQO: 'Dqo', DQP: 'Dqp', DQS: 'Dqs', DQT: 'Dqt',
    DQU: 'Dqu', DQV: 'Dqv', DQW: 'Dqw', DQX: 'Dqx',
    DQY: 'Dqy', DQZ: 'Dqz', DRA: 'Dra', DRC: 'Drc',
    DRI: 'Dri', DRL: 'Drl', DRN: 'Drn', DRS: 'Drs',
    DRX: 'Drx', DSC: 'Dsc', DSE: 'Dse', DSG: 'Dsg',
    DSI: 'Dsi', DSL: 'Dsl', DSM: 'Dsm', DSP: 'Dsp',
    DSR: 'Dsr', DSS: 'Dss', DST: 'Dst', DTC: 'Dtc',
    DTE: 'Dte', DTI: 'Dti', DTL: 'Dtl', DTN: 'Dtn',
    DTR: 'Dtr', DTS: 'Dts', DTV: 'Dtv', DTX: 'Dtx',
    DUK: 'Duk', DUN: 'Dun', DUP: 'Dup', DVC: 'Dvc',
    DVD: 'Dvd', DVE: 'Dve', DVI: 'Dvi', DVL: 'Dvl',
    DVN: 'Dvn', DVS: 'Dvs', DVT: 'Dvt', DVX: 'Dvx',
    DWC: 'Dwc', DWE: 'Dwe', DWI: 'Dwi', DWL: 'Dwl',
    DWN: 'Dwn', DWS: 'Dws', DWT: 'Dwt', DWX: 'Dwx',
    DXC: 'Dxc', DXE: 'Dxe', DXG: 'Dxg', DXI: 'Dxi',
    DXL: 'Dxl', DXN: 'Dxn', DXP: 'Dxp', DXR: 'Dxr',
    DXS: 'Dxs', DXT: 'Dxt', DXV: 'Dxv', DXX: 'Dxx',
    DYN: 'Dyn', DYS: 'Dys', DYT: 'Dyt', DYX: 'Dyx',
    EAL: 'Eal', EAS: 'Eas', EAT: 'Eat', EAX: 'Eax',
    EBA: 'Eba', EBC: 'Ebc', EBI: 'Ebi', EBM: 'Ebm',
    EBN: 'Ebn', EBS: 'Ebs', EBT: 'Ebt', EBU: 'EBU',
    ECA: 'Eca', ECB: 'Ecb', ECC: 'Ecc', ECD: 'Ecd',
    ECE: 'Ece', ECF: 'Ecf', ECG: 'Ecg', ECH: 'Ech',
    ECI: 'Eci', ECK: 'Eck', ECL: 'Ecl', ECM: 'Ecm',
    ECN: 'Ecn', ECO: 'Eco', ECP: 'Ecp', ECS: 'ECS',
    ECT: 'Ect', ECV: 'Ecv', ECX: 'Ecx', ECY: 'Ecy',
    EDA: 'Eda', EDB: 'Edb', EDC: 'Edc', EDD: 'Edd',
    EDE: 'Ede', EDF: 'Edf', EDG: 'Edg', EDI: 'Edi',
    EDK: 'Edk', EDL: 'Edl', EDM: 'Edm', EDN: 'Edn',
    EDO: 'Edo', EDP: 'Edp', EDR: 'Edr', EDS: 'Eds',
    EDT: 'Edt', EDU: 'Edu', EDV: 'Edv', EDW: 'Edw',
    EDX: 'Edx', EDY: 'Edy', EDZ: 'Edz', EEA: 'Eea',
    EEB: 'Eeb', EEC: 'Eec', EED: 'Eed', EEE: 'Eee',
    EEG: 'Eeg', EEH: 'Eeh', EEI: 'Eei', EEL: 'Eel',
    EEM: 'Eem', EEN: 'Een', EEO: 'Eeo', EEP: 'Eep',
    EES: 'Ees', EET: 'Eet', EEV: 'Eev', EEX: 'Eex',
    EFC: 'Efc', EFF: 'Eff', EFI: 'Efi', EFO: 'Efo',
    EFR: 'Efr', EFS: 'Efs', EGA: 'Ega', EGC: 'Egc',
    EGG: 'Egg', EGI: 'Egi', EGL: 'Egl', EGM: 'Egm',
    EGN: 'Egn', EGO: 'Ego', EGP: 'Egp', EGS: 'Egs',
    EGT: 'Egt', EGY: 'Egy', EIA: 'Eia', EIC: 'Eic',
    EID: 'Eid', EIE: 'Eie', EIG: 'Eig', EIK: 'Eik',
    EIL: 'Eil', EIM: 'Eim', EIN: 'Ein', EIO: 'Eio',
    EIP: 'Eip', EIR: 'Eir', EIS: 'Eis', EIT: 'Eit',
    EIV: 'Eiv', EIW: 'Eiw', EIX: 'Eix', EIY: 'Eiy',
    EIZ: 'Eiz', EKA: 'Eka', EKB: 'Ekb', EKC: 'Ekc',
    EKD: 'Ekd', EKE: 'Eke', EKF: 'Ekf', EKG: 'Ekg',
    EKH: 'Ekh', EKI: 'Eki', EKJ: 'Ekj', EKK: 'Ekk',
    EKL: 'Ekl', EKM: 'Ekm', EKN: 'Ekn', EKO: 'Eko',
    EKP: 'Ekp', EKQ: 'Ekq', EKR: 'Ekr', EKS: 'Eks',
    EKT: 'Ekt', EKU: 'Eku', EKV: 'Ekv', EKW: 'Ekw',
    EKX: 'Ekx', EKY: 'Eky', EKZ: 'Ekz', ELA: 'Ela',
    ELC: 'Elc', ELD: 'Eld', ELE: 'Ele', ELF: 'Elf',
    ELG: 'Elg', ELI: 'Eli', ELK: 'Elk', ELL: 'Ell',
    ELM: 'Elm', ELO: 'Elo TouchSystems', ELS: 'Els',
    ELT: 'Elt', ELU: 'Elu', ELV: 'Elv', ELX: 'Elx',
    EMA: 'Ema', EMB: 'Emb', EMC: 'Emc', EMD: 'Emd',
    EME: 'Eme', EMF: 'Emf', EMG: 'Emg', EMI: 'Emi',
    EMJ: 'Emj', EMK: 'Emk', EML: 'Eml', EMM: 'Emm',
    EMN: 'Emn', EMO: 'Emo', EMP: 'Emp', EMR: 'Emr',
    EMS: 'Ems', EMT: 'Emt', EMU: 'Emu', EMV: 'Emv',
    EMW: 'Emw', EMX: 'Emx', EMY: 'Emy', EMZ: 'Emz',
    ENA: 'Ena', ENB: 'Enb', ENC: 'Enc', END: 'End',
    ENE: 'Ene', ENF: 'Enf', ENG: 'Eng', ENH: 'Enh',
    ENI: 'Eni', ENJ: 'Enj', ENK: 'Enk', ENL: 'Enl',
    ENM: 'Enm', ENN: 'Enn', ENO: 'Eno', ENP: 'Enp',
    ENQ: 'Enq', ENR: 'Enr', ENS: 'Ens', ENT: 'Ent',
    ENU: 'Enu', ENV: 'Env', ENW: 'Enw', ENX: 'Enx',
    ENY: 'Eny', ENZ: 'Enz', EON: 'Eon', EPI: 'EPI',
    EPO: 'Epson', EPS: 'Epson', EPT: 'Ept', EPV: 'Epv',
    ERA: 'Era', ERC: 'Erc', ERE: 'Ere', ERG: 'Erg',
    ERI: 'Eri', ERL: 'Erl', ERM: 'Erm', ERN: 'Ern',
    ERO: 'Ero', ERP: 'Erp', ERR: 'Err', ERS: 'Ers',
    ERT: 'Ert', ERV: 'Erv', ERX: 'Erx', ESA: 'Esa',
    ESB: 'Esb', ESC: 'Esc', ESD: 'Esd', ESE: 'Ese',
    ESF: 'Esf', ESG: 'Esg', ESH: 'Esh', ESI: 'ESI',
    ESK: 'Esk', ESL: 'Esl', ESM: 'Esm', ESN: 'Esn',
    ESO: 'Eso', ESP: 'Esp', ESR: 'Esr', ESS: 'ESS Technology',
    EST: 'Est', ESU: 'Esu', ESV: 'Esv', ESW: 'Esw',
    ESX: 'Esx', ESY: 'Esy', ETB: 'Etb', ETC: 'Etc',
    ETD: 'Etd', ETE: 'Ete', ETF: 'Etf', ETG: 'Etg',
    ETH: 'Eth', ETI: 'Eti', ETK: 'Etk', ETL: 'Etl',
    ETM: 'Etm', ETN: 'Etn', ETO: 'Eto', ETP: 'Etp',
    ETR: 'Etr', ETS: 'Ets', ETT: 'Ett', ETU: 'Etu',
    ETV: 'Etv', ETW: 'Etw', ETX: 'Etx', ETY: 'Ety',
    EUA: 'Eua', EUR: 'Eur', EVA: 'Eva', EVC: 'Evc',
    EVD: 'Evd', EVE: 'Eve', EVF: 'Evf', EVG: 'Evg',
    EVI: 'Evi', EVL: 'Evl', EVM: 'Evm', EVN: 'Evn',
    EVO: 'Evo', EVP: 'Evp', EVR: 'Evr', EVS: 'Evs',
    EVT: 'Evt', EVU: 'Evu', EVV: 'Evv', EVW: 'Evw',
    EVX: 'Evx', EWK: 'Ewk', EXA: 'Exa', EXB: 'Exb',
    EXC: 'Exc', EXD: 'Exd', EXE: 'Exe', EXF: 'Exf',
    EXG: 'Exg', EXH: 'Exh', EXI: 'Exi', EXK: 'Exk',
    EXL: 'Exl', EXM: 'Exm', EXN: 'Exn', EXO: 'Exo',
    EXP: 'Exp', EXR: 'Exr', EXS: 'Exs', EXT: 'Ext',
    EXU: 'Exu', EXV: 'Exv', EXW: 'Exw', EXX: 'Exx',
    EYA: 'Eya', EYE: 'Eye', EZC: 'Ezc', FAI: 'Fai',
    FAN: 'Fan', FAS: 'Fas', FAV: 'Fav', FBK: 'Fbk',
    FCL: 'Fcl', FCM: 'Fcm', FCS: 'Fcs', FDC: 'Fdc',
    FDD: 'Fdd', FDN: 'Fdn', FDS: 'Fds', FEL: 'Fel',
    FFC: 'Ffc', FGD: 'Fgd', FHX: 'Fuhua', FIC: 'FIC',
    FIS: 'Fis', FLI: 'Fli', FLT: 'Flt', FLY: 'Fly',
    FMC: 'Fmc', FMI: 'Fmi', FML: 'Fml', FMS: 'Fms',
    FNC: 'Fnc', FNI: 'Fni', FNK: 'Fnk', FNL: 'Fnl',
    FNM: 'Fnm', FNN: 'Fnn', FNS: 'Fns', FNT: 'Fnt',
    FNX: 'Fnx', FOC: 'Foc', FOI: 'Foi', FOR: 'Forward',
    FOS: 'Fos', FOV: 'Fov', FPC: 'Fpc', FPE: 'Fpe',
    FPS: 'Fps', FPT: 'Fpt', FRC: 'Frc', FRI: 'Fri',
    FRO: 'Fro', FRY: 'Fry', FSC: 'Fsc', FSI: 'Fsi',
    FSN: 'Fsn', FSR: 'Fsr', FST: 'Fst', FTC: 'Ftc',
    FTD: 'Ftd', FTL: 'Ftl', FTN: 'Ftn', FTR: 'Ftr',
    FTS: 'Fts', FTV: 'Ftv', FUA: 'Fua', FUC: 'Fuc',
    FUD: 'Fud', FUE: 'Fue', FUG: 'Fug', FUJ: 'Fujitsu',
    FUJITSU: 'Fujitsu', FUN: 'Fun', FUS: 'Fus', FUT: 'Fut',
    FUV: 'Fuv', FUZ: 'Fuz', FVC: 'Fvc', FVI: 'Fvi',
    FVL: 'Fvl', FVN: 'Fvn', FVS: 'Fvs', FVT: 'Fvt',
    FWA: 'Fwa', FWB: 'Fwb', FWC: 'Fwc', FWD: 'Fwd',
    FWE: 'Fwe', FWI: 'Fwi', FWL: 'Fwl', FWM: 'Fwm',
    FWN: 'Fwn', FWO: 'Fwo', FWP: 'Fwp', FWR: 'Fwr',
    FWS: 'Fws', FWT: 'Fwt', FWX: 'Fwx', FXA: 'Fxa',
    FXB: 'Fxb', FXC: 'Fxc', FXD: 'Fxd', FXE: 'Fxe',
    FXG: 'Fxg', FXI: 'Fxi', FXM: 'Fxm', FXN: 'Fxn',
    FXP: 'Fxp', FXR: 'Fxr', FXS: 'Fxs', FXT: 'Fxt',
    FXX: 'Fxx', GAC: 'Gac', GAG: 'Gag', GAL: 'Gal',
    GAM: 'Gam', GAN: 'Gan', GAP: 'Gap', GAR: 'Gar',
    GAS: 'Gas', GAT: 'Gat', GAU: 'Gau', GAV: 'Gav',
    GAW: 'Gaw', GAX: 'Gax', GAY: 'Gay', GAZ: 'Gaz',
    GBC: 'Gbc', GBI: 'Gbi', GBM: 'Gbm', GBN: 'Gbn',
    GBP: 'Gbp', GBR: 'Gbr', GBS: 'Gbs', GBT: 'Gbt',
    GBU: 'Gbu', GBX: 'Gbx', GCA: 'Gca', GCB: 'Gcb',
    GCC: 'Gcc', GCD: 'Gcd', GCE: 'Gce', GCF: 'Gcf',
    GCG: 'Gcg', GCH: 'Gch', GCI: 'Gci', GCK: 'Gck',
    GCL: 'Gcl', GCM: 'Gcm', GCN: 'Gcn', GCO: 'Gco',
    GCP: 'Gcp', GCS: 'Gcs', GCT: 'Gct', GCU: 'Gcu',
    GCV: 'Gcv', GCX: 'Gcx', GCY: 'Gcy', GDA: 'Gda',
    GDB: 'Gdb', GDC: 'Gdc', GDD: 'Gdd', GDE: 'Gde',
    GDF: 'Gdf', GDG: 'Gdg', GDH: 'Gdh', GDI: 'Gdi',
    GDK: 'Gdk', GDL: 'Gdl', GDM: 'Gdm', GDN: 'Gdn',
    GDO: 'Gdo', GDP: 'Gdp', GDR: 'Gdr', GDS: 'Gds',
    GDT: 'Gdt', GDU: 'Gdu', GDV: 'Gdv', GDW: 'Gdw',
    GDX: 'Gdx', GDY: 'Gdy', GEA: 'Gea', GEC: 'Gec',
    GED: 'Ged', GEE: 'Gee', GEF: 'Gef', GEH: 'Geh',
    GEI: 'Gei', GEL: 'Gel', GEM: 'Gem', GEN: 'Gen',
    GEO: 'Geo', GEP: 'Gep', GER: 'Ger', GES: 'Ges',
    GET: 'Get', GEV: 'Gev', GEW: 'Gew', GEX: 'Gex',
    GEY: 'Gey', GFA: 'Gfa', GFB: 'Gfb', GFC: 'Gfc',
    GFD: 'Gfd', GFE: 'Gfe', GFF: 'Gff', GFG: 'Gfg',
    GFH: 'Gfh', GFI: 'Gfi', GFK: 'Gfk', GFL: 'Gfl',
    GFM: 'Gfm', GFN: 'Gfn', GFO: 'Gfo', GFP: 'Gfp',
    GFR: 'Gfr', GFS: 'Gfs', GFT: 'Gft', GFU: 'Gfu',
    GFV: 'Gfv', GFW: 'Gfw', GFX: 'Gfx', GFY: 'Gfy',
    GGA: 'Gga', GGC: 'Ggc', GGD: 'Ggd', GGE: 'Gge',
    GGG: 'Ggg', GGI: 'Ggi', GGL: 'Ggl', GGM: 'Ggm',
    GGN: 'Ggn', GGO: 'Ggo', GGP: 'Ggp', GGR: 'Ggr',
    GGS: 'Ggs', GGT: 'Ggt', GGU: 'Ggu', GGW: 'Ggw',
    GGX: 'Ggx', GHA: 'Gha', GHB: 'Ghb', GHC: 'Ghc',
    GHD: 'Ghd', GHE: 'Ghe', GHF: 'Ghf', GHG: 'Ghg',
    GHH: 'Ghh', GHI: 'Ghi', GHJ: 'Ghj', GHK: 'Ghk',
    GHL: 'Ghl', GHM: 'Ghm', GHN: 'Ghn', GHO: 'Gho',
    GHP: 'Ghp', GHR: 'Ghr', GHS: 'Ghs', GHT: 'Ght',
    GHU: 'Ghu', GHV: 'Ghv', GHW: 'Ghw', GHX: 'Ghx',
    GHY: 'Ghy', GHZ: 'Ghz', GIA: 'Gia', GIC: 'Gic',
    GID: 'Gid', GIE: 'Gie', GIF: 'Gif', GIG: 'Gig',
    GIH: 'Gih', GII: 'Gii', GIK: 'Gik', GIL: 'Gil',
    GIM: 'Gim', GIN: 'Gin', GIO: 'Gio', GIP: 'Gip',
    GIQ: 'Giq', GIR: 'Gir', GIS: 'Gis', GIT: 'Git',
    GIU: 'Giu', GIV: 'Giv', GIW: 'Giw', GIX: 'Gix',
    GIY: 'Giy', GIZ: 'Giz', GJC: 'Gjc', GJE: 'Gje',
    GJI: 'Gji', GJM: 'Gjm', GJN: 'Gjn', GJP: 'Gjp',
    GJS: 'Gjs', GJT: 'Gjt', GJU: 'Gju', GJW: 'Gjw',
    GJX: 'Gjx', GKA: 'Gka', GKB: 'Gkb', GKC: 'Gkc',
    GKD: 'Gkd', GKE: 'Gke', GKF: 'Gkf', GKG: 'Gkg',
    GKH: 'Gkh', GKI: 'Gki', GKJ: 'Gkj', GKK: 'Gkk',
    GKL: 'Gkl', GKM: 'Gkm', GKN: 'Gkn', GKO: 'Gko',
    GKP: 'Gkp', GKQ: 'Gkq', GKR: 'Gkr', GKS: 'Gks',
    GKT: 'Gkt', GKU: 'Gku', GKV: 'Gkv', GKW: 'Gkw',
    GKX: 'Gkx', GKY: 'Gky', GKZ: 'Gkz', GLA: 'Gla',
    GLB: 'Glb', GLC: 'Glc', GLD: 'Gld', GLE: 'Gle',
    GLF: 'Glf', GLG: 'Glg', GLH: 'Glh', GLI: 'Gli',
    GLJ: 'Glj', GLK: 'Glk', GLL: 'Gll', GLM: 'Glm',
    GLN: 'Gln', GLO: 'Glo', GLP: 'Glp', GLQ: 'Glq',
    GLR: 'Glr', GLS: 'Gls', GLT: 'Glt', GLU: 'Glu',
    GLV: 'Glv', GLW: 'Glw', GLX: 'Glx', GLY: 'Gly',
    GLZ: 'Glz', GMA: 'Gma', GMB: 'Gmb', GMC: 'Gmc',
    GMD: 'Gmd', GME: 'Gme', GMF: 'Gmf', GMG: 'Gmg',
    GMH: 'Gmh', GMI: 'Gmi', GMJ: 'Gmj', GMK: 'Gmk',
    GML: 'Gml', GMM: 'Gmm', GMN: 'Gmn', GMO: 'Gmo',
    GMP: 'Gmp', GMQ: 'Gmq', GMR: 'Gmr', GMS: 'Gms',
    GMT: 'Gmt', GMU: 'Gmu', GMV: 'Gmv', GMW: 'Gmw',
    GMX: 'Gmx', GMY: 'Gmy', GMZ: 'Gmz', GNA: 'Gna',
    GNB: 'Gnb', GNC: 'Gnc', GND: 'Gnd', GNE: 'Gne',
    GNF: 'Gnf', GNG: 'Gng', GNH: 'Gnh', GNI: 'Gni',
    GNJ: 'Gnj', GNK: 'Gnk', GNL: 'Gnl', GNM: 'Gnm',
    GNN: 'Gnn', GNO: 'Gno', GNP: 'Gnp', GNQ: 'Gnq',
    GNR: 'Gnr', GNS: 'Gns', GNT: 'Gnt', GNU: 'Gnu',
    GNV: 'Gnv', GNW: 'Gnw', GNX: 'Gnx', GNY: 'Gny',
    GNZ: 'Gnz', GOA: 'Goa', GOB: 'Gob', GOC: 'Goc',
    GOD: 'God', GOE: 'Goe', GOF: 'Gof', GOG: 'Gog',
    GOH: 'Goh', GOI: 'Goi', GOJ: 'Goj', GOK: 'Gok',
    GOL: 'Gol', GOM: 'Gom', GON: 'Gon', GOO: 'Goo',
    GOP: 'Gop', GOQ: 'Goq', GOR: 'Gor', GOS: 'Gos',
    GOT: 'Got', GOU: 'Gou', GOV: 'Gov', GOW: 'Gow',
    GOX: 'Gox', GOY: 'Goy', GOZ: 'Goz', GPA: 'Gpa',
    GPB: 'Gpb', GPC: 'Gpc', GPD: 'Gpd', GPE: 'Gpe',
    GPF: 'Gpf', GPG: 'Gpg', GPH: 'Gph', GPI: 'Gpi',
    GPJ: 'Gpj', GPK: 'Gpk', GPL: 'Gpl', GPM: 'Gpm',
    GPN: 'Gpn', GPO: 'Gpo', GPP: 'Gpp', GPQ: 'Gpq',
    GPR: 'Gpr', GPS: 'Gps', GPT: 'Gpt', GPU: 'Gpu',
    GPV: 'Gpv', GPW: 'Gpw', GPX: 'Gpx', GPY: 'Gpy',
    GPZ: 'Gpz', GRA: 'Gra', GRB: 'Grb', GRC: 'Grc',
    GRD: 'Grd', GRE: 'Gre', GRF: 'Grf', GRG: 'Grg',
    GRH: 'Grh', GRI: 'Gri', GRJ: 'Grj', GRK: 'Grk',
    GRL: 'Grl', GRM: 'Grm', GRN: 'Grn', GRO: 'Gro',
    GRP: 'Grp', GRQ: 'Grq', GRR: 'Grr', GRS: 'Grs',
    GRT: 'Grt', GRU: 'Gru', GRV: 'Grv', GRW: 'Grw',
    GRX: 'Grx', GRY: 'Gry', GRZ: 'Grz', GSA: 'Gsa',
    GSB: 'Gsb', GSC: 'Gsc', GSD: 'Gsd', GSE: 'Gse',
    GSF: 'Gsf', GSG: 'Gsg', GSH: 'Gsh', GSI: 'Gsi',
    GSJ: 'Gsj', GSK: 'Gsk', GSL: 'Gsl', GSM: 'LG Electronics',
    GSN: 'Gsn', GSO: 'Gso', GSP: 'Gsp', GSQ: 'Gsq',
    GSR: 'Gsr', GSS: 'Gss', GST: 'Gst', GSU: 'Gsu',
    GSV: 'Gsv', GSW: 'Gsw', GSX: 'Gsx', GSY: 'Gsy',
    GSZ: 'Gsz', GTA: 'Gta', GTB: 'Gtb', GTC: 'Gtc',
    GTD: 'Gtd', GTE: 'Gte', GTF: 'Gtf', GTG: 'Gtg',
    GTH: 'Gth', GTI: 'Gti', GTJ: 'Gtj', GTK: 'Gtk',
    GTL: 'Gtl', GTM: 'Gtm', GTN: 'Gtn', GTO: 'Gto',
    GTP: 'Gtp', GTQ: 'Gtq', GTR: 'Gtr', GTS: 'Gts',
    GTT: 'Gtt', GTU: 'Gtu', GTV: 'Gtv', GTW: 'Gtw',
    GTX: 'Gtx', GTY: 'Gty', GTZ: 'Gtz', GUA: 'Gua',
    GUB: 'Gub', GUC: 'Guc', GUD: 'Gud', GUE: 'Gue',
    GUF: 'Guf', GUG: 'Gug', GUH: 'Guh', GUI: 'Gui',
    GUJ: 'Guj', GUK: 'Guk', GUL: 'Gul', GUM: 'Gum',
    GUN: 'Gun', GUO: 'Guo', GUP: 'Gup', GUQ: 'Guq',
    GUR: 'Gur', GUS: 'Gus', GUT: 'Gut', GUU: 'Guu',
    GUV: 'Guv', GUW: 'Guw', GUX: 'Gux', GUY: 'Guy',
    GUZ: 'Guz', GVA: 'Gva', GVB: 'Gvb', GVC: 'Gvc',
    GVD: 'Gvd', GVE: 'Gve', GVF: 'Gvf', GVG: 'Gvg',
    GVH: 'Gvh', GVI: 'Gvi', GVJ: 'Gvj', GVK: 'Gvk',
    GVL: 'Gvl', GVM: 'Gvm', GVN: 'Gvn', GVO: 'Gvo',
    GVP: 'Gvp', GVQ: 'Gvq', GVR: 'Gvr', GVS: 'Gvs',
    GVT: 'Gvt', GVU: 'Gvu', GWY: 'Gateway', HAE: 'Haemimont',
    HAL: 'Hal', HAR: 'Harmony', HAS: 'Has', HAT: 'Hat',
    HBG: 'HBG', HCP: 'HCP', HDN: 'Hdn', HDS: 'HDS',
    HEC: 'Hec', HEL: 'Hel', HER: 'Hercules', HEW: 'Hewlett Packard',
    HEI: 'Hei', HIG: 'Hig', HIT: 'Hitachi', HIQ: 'HiQ',
    HMC: 'HMC', HMN: 'Hmn', HNS: 'Hns', HON: 'Hon',
    HOP: 'Hop', HPA: 'Hewlett Packard', HPC: 'HPC',
    HPD: 'Hewlett Packard', HPI: 'HPI', HPK: 'Hewlett Packard',
    HPN: 'Hewlett Packard', HPS: 'Hewlett Packard',
    HPT: 'Hewlett Packard', HPX: 'Hewlett Packard',
    HSD: 'Hsd', HSI: 'Hsi', HSN: 'Hsn', HSR: 'Hsr',
    HST: 'Hst', HTC: 'HTC', HTI: 'Hti', HTK: 'Htk',
    HTL: 'Htl', HTM: 'Htm', HTN: 'Htn', HTO: 'Hto',
    HTP: 'Htp', HTR: 'Htr', HTS: 'Hts', HTT: 'Htt',
    HTU: 'Htu', HTV: 'Htv', HTW: 'Htw', HTX: 'Htx',
    HTY: 'Hty', HTZ: 'Htz', HUA: 'Hua', HUB: 'Hub',
    HUC: 'Huc', HUD: 'Hud', HUE: 'Hue', HUF: 'Huf',
    HUG: 'Hug', HUH: 'Huh', HUI: 'Hui', HUJ: 'Huj',
    HUK: 'Huk', HUL: 'Hul', HUM: 'Hum', HUN: 'Hun',
    HUO: 'Huo', HUP: 'Hup', HUQ: 'Huq', HUR: 'Hur',
    HUS: 'Hus', HUT: 'Hut', HUU: 'Huu', HUV: 'Huv',
    HUW: 'Huw', HUX: 'Hux', HUY: 'Huy', HUZ: 'Huz',
    HVA: 'Hva', HVB: 'Hvb', HVC: 'Hvc', HVD: 'Hvd',
    HVE: 'Hve', HVF: 'Hvf', HVG: 'Hvg', HVH: 'Hvh',
    HVI: 'Hvi', HVJ: 'Hvj', HVK: 'Hvk', HVL: 'Hvl',
    HVM: 'Hvm', HVN: 'Hvn', HVO: 'Hvo', HVP: 'Hvp',
    HVQ: 'Hvq', HVR: 'Hvr', HVS: 'Hvs', HVT: 'Hvt',
    HVU: 'Hvu', HVV: 'Hvv', HWA: 'Hwa', HWB: 'Hwb',
    HWC: 'Hwc', HWD: 'Hwd', HWE: 'Hwe', HWF: 'Hwf',
    HWG: 'Hwg', HWH: 'Hwh', HWI: 'Hwi', HWJ: 'Hwj',
    HWK: 'Hwk', HWL: 'Hwl', HWM: 'Hwm', HWN: 'Hwn',
    HWO: 'Hwo', HWP: 'HP', HWQ: 'Hwq', HWR: 'Hwr',
    HWS: 'Hws', HWT: 'Hwt', HWU: 'Hwu', HWV: 'Hwv',
    HWW: 'Hww', HWX: 'Hwx', HWY: 'Hwy', HWZ: 'Hwz',
    HXA: 'Hxa', HXB: 'Hxb', HXC: 'Hxc', HXD: 'Hxd',
    HXE: 'Hxe', HXF: 'Hxf', HXG: 'Hxg', HXH: 'Hxh',
    HXI: 'Hxi', HXJ: 'Hxj', HXK: 'Hxk', HXL: 'Hxl',
    HXM: 'Hxm', HXN: 'Hxn', HXO: 'Hxo', HXP: 'Hxp',
    HXQ: 'Hxq', HXR: 'Hxr', HXS: 'Hxs', HXT: 'Hxt',
    HXU: 'Hxu', HXV: 'Hxv', HXW: 'Hxw', HXX: 'Hxx',
    HYA: 'Hya', HYB: 'Hyb', HYC: 'Hyc', HYD: 'Hyd',
    HYE: 'Hye', HYF: 'Hyf', HYG: 'Hyg', HYH: 'Hyh',
    HYI: 'Hyi', HYJ: 'Hyj', HYK: 'Hyk', HYL: 'Hyl',
    HYM: 'Hym', HYN: 'Hyn', HYO: 'Hyo', HYP: 'Hyp',
    HYQ: 'Hyq', HYR: 'Hyr', HYS: 'Hys', HYT: 'Hyt',
    HYU: 'Hyu', HYV: 'Hyv', HYW: 'Hyw', HYX: 'Hyx',
    HYY: 'Hyy', HYZ: 'Hyz', HZA: 'Hza', HZB: 'Hzb',
    HZC: 'Hzc', HZD: 'Hzd', HZE: 'Hze', HZF: 'Hzf',
    HZG: 'Hzg', HZH: 'Hzh', HZI: 'Hzi', HZJ: 'Hzj',
    HZK: 'Hzk', HZL: 'Hzl', HZM: 'Hzm', HZN: 'Hzn',
    HZO: 'Hzo', HZP: 'Hzp', HZQ: 'Hzq', HZR: 'Hzr',
    HZS: 'Hzs', HZT: 'Hzt', HZU: 'Hzu', HZV: 'Hzv',
    HZW: 'Hzw', HZX: 'Hzx', HZY: 'Hzy', HZZ: 'Hzz',
    IBC: 'Ibc', IBM: 'IBM', ICL: 'ICL', ICS: 'ICS',
    IGN: 'Ign', IIS: 'Iis', IKE: 'Ike', IMG: 'Image',
    INC: 'Inc', INI: 'Ini', INL: 'Inl', INT: 'Intel',
    INV: 'Inv', IOD: 'IODATA', IOM: 'Iomega', IOI: 'IOI',
    IRV: 'Irv', ISM: 'Ism', ITC: 'ITC', ITE: 'ITE',
    ITS: 'Its', JCE: 'Jce', JDI: 'JDI', JDL: 'Jdl',
    JED: 'JEDEC', JET: 'Jet', JFC: 'Jfc', JFD: 'Jfd',
    JIA: 'Jia', JIC: 'Jic', JIN: 'Jin', JIS: 'Jis',
    JIU: 'Jiu', JNC: 'Jnc', JNZ: 'Jnz', JVC: 'JVC',
    JWD: 'Jwd', KAI: 'Kai', KDS: 'KDS', KFC: 'Kfc',
    KIA: 'Kia', KIN: 'Kin', KME: 'Kme', KNC: 'Knc',
    KOD: 'Kodak', KOH: 'Koh', KOI: 'Koi', KON: 'Kon',
    KOR: 'Kor', KPC: 'Kpc', KRE: 'Kre', KSI: 'Ksi',
    KTC: 'KTC', KTX: 'Ktx', LAC: 'Lac', LAN: 'Lan',
    LAP: 'Lap', LCI: 'LCI', LCS: 'Lcs', LEA: 'Lea',
    LEN: 'Lenovo', LEO: 'Leo', LEX: 'Lex', LGD: 'LG Display',
    LGE: 'LG Electronics', LGI: 'Lgi', LGL: 'Lgl',
    LGN: 'Lgn', LGP: 'Lgp', LGS: 'Lgs', LGT: 'Lgt',
    LIN: 'Lin', LIV: 'Liv', LKM: 'Lkm', LMT: 'Lmt',
    LOG: 'Logitech', LOK: 'Lok', LOT: 'Lot', LPL: 'LG Philips',
    LSA: 'Lsa', LSC: 'Lsc', LSI: 'LSI', LTC: 'Ltc',
    LTD: 'Ltd', LTE: 'Lte', LTL: 'Ltl', LTM: 'Ltm',
    LTS: 'Lts', LUC: 'Luc', LUX: 'Lux', MAA: 'Maa',
    MAC: 'Mac', MAG: 'MAG Innovision', MAL: 'Mal',
    MAN: 'Man', MAR: 'Mar', MAS: 'Mas', MAT: 'Matrox',
    MAX: 'Max', MBC: 'Mbc', MCD: 'Mcd', MCI: 'Mci',
    MCL: 'Mcl', MCM: 'Mcm', MCO: 'Mco', MCP: 'Mcp',
    MCS: 'Mcs', MCT: 'Mct', MCX: 'Mcx', MDA: 'Mda',
    MDC: 'Mdc', MDD: 'Mdd', MDE: 'Mde', MDG: 'Mdg',
    MDI: 'Mdi', MDL: 'Mdl', MDM: 'Mdm', MDN: 'Mdn',
    MDO: 'Mdo', MDP: 'Mdp', MDR: 'Mdr', MDS: 'Mds',
    MDT: 'Mdt', MDU: 'Mdu', MDV: 'Mdv', MDX: 'Mdx',
    MED: 'Med', MEG: 'Meg', MEI: 'Mei', MEL: 'Mel',
    MEN: 'Men', MER: 'Mer', MET: 'Met', MGA: 'MGA',
    MGC: 'Mgc', MGT: 'Mgt', MIC: 'Mic', MID: 'Mid',
    MII: 'Mii', MIN: 'Minolta', MIR: 'Mir', MIS: 'Mis',
    MIT: 'Mit', MIX: 'Mix', MIZ: 'Miz', MKC: 'Mkc',
    MKE: 'Mke', MKI: 'Mki', MKS: 'Mks', MLI: 'Mli',
    MMB: 'Mmb', MMC: 'Mmc', MME: 'Mme', MMG: 'Mmg',
    MMI: 'Mmi', MMM: 'Mmm', MMS: 'Mms', MMT: 'Mmt',
    MMX: 'Mmx', MNC: 'Mnc', MND: 'Mnd', MNE: 'Mne',
    MNL: 'Mnl', MNN: 'Mnn', MNS: 'Mns', MNT: 'Mnt',
    MNX: 'Mnx', MOC: 'Moc', MOD: 'Mod', MOI: 'Moi',
    MON: 'Mon', MOR: 'Mor', MOT: 'Motorola', MPC: 'Mpc',
    MRD: 'Mrd', MRL: 'Mrl', MRN: 'Mrn', MRS: 'Mrs',
    MRT: 'Mrt', MSC: 'Msc', MSH: 'Msh', MSI: 'MSI',
    MSL: 'Msl', MSN: 'Msn', MSP: 'Msp', MST: 'Mst',
    MSX: 'Msx', MTC: 'Mtc', MTI: 'Mti', MTL: 'Mtl',
    MTM: 'Mtm', MTN: 'Mtn', MTS: 'Mts', MTT: 'Mtt',
    MTX: 'Mtx', MUD: 'Mud', MUL: 'Mul', MUR: 'Mur',
    MUT: 'Mut', MVI: 'Mvi', MVM: 'Mvm', MXI: 'Mxi',
    MXL: 'Mxl', MXN: 'Mxn', NAI: 'Nai', NAC: 'Nac',
    NAD: 'Nad', NAK: 'Nak', NAN: 'Nan', NAT: 'Nat',
    NAV: 'Nav', NBC: 'Nbc', NCA: 'Nca', NCC: 'Ncc',
    NCE: 'Nce', NCI: 'Nci', NCL: 'Ncl', NCP: 'Ncp',
    NCS: 'Ncs', NCT: 'Nct', NCV: 'Ncv', NEC: 'NEC',
    NEO: 'Neo', NET: 'Net', NEW: 'New', NIC: 'Nic',
    NIN: 'Nin', NIS: 'Nis', NIT: 'Nit', NIX: 'Nix',
    NLC: 'Nlc', NMS: 'Nms', NNC: 'Nnc', NOD: 'Nod',
    NOK: 'Nokia', NOR: 'Nor', NOV: 'Nov', NPC: 'Npc',
    NPI: 'Npi', NRT: 'Nrt', NSA: 'Nsa', NSC: 'National Semiconductor',
    NSI: 'Nsi', NSM: 'Nsm', NSS: 'Nss', NTC: 'Ntc',
    NTI: 'Nti', NTL: 'Ntl', NTS: 'Nts', NTT: 'Ntt',
    NVC: 'Nvc', NVD: 'NVIDIA', NVE: 'Nve', NVI: 'Nvi',
    NVS: 'Nvs', NWC: 'Nwc', NYA: 'Nya', OAS: 'Oas',
    OCE: 'Oce', ODD: 'Odd', OKI: 'Oki', OLC: 'Olc',
    OLI: 'Oli', OLY: 'Olympus', OMN: 'Omn', ONK: 'Onk',
    ONY: 'Ony', OPT: 'Opt', ORC: 'Orc', ORI: 'Ori',
    ORT: 'Ort', OSI: 'Osi', OTC: 'Otc', OTI: 'Oti',
    OTM: 'Otm', OTT: 'Ott', OUL: 'Oul', OUS: 'Ous',
    PAC: 'Pac', PAI: 'Pai', PAL: 'Pal', PAN: 'Panasonic',
    PAR: 'Par', PAT: 'Pat', PBE: 'Pbe', PBI: 'Pbi',
    PCA: 'Pca', PCC: 'Pcc', PCI: 'Pci', PCM: 'Pcm',
    PCR: 'Pcr', PCX: 'Pcx', PDC: 'Pdc', PDS: 'Pds',
    PEC: 'Pec', PEG: 'Peg', PEI: 'Pei', PEN: 'Pen',
    PER: 'Per', PFS: 'Pfs', PGA: 'Pga', PGC: 'Pgc',
    PHI: 'Philips', PHL: 'Philips', PHO: 'Pho',
    PHT: 'Pht', PIC: 'Pic', PII: 'Pii', PIL: 'Pil',
    PIO: 'Pio', PIX: 'Pix', PJD: 'Pjd', PKE: 'Pke',
    PLI: 'Pli', PLX: 'PLX', PMC: 'Pmc', PMI: 'Pmi',
    PMS: 'Pms', PNC: 'Pnc', PNI: 'Pni', PNT: 'Pnt',
    POL: 'Pol', POS: 'Pos', POW: 'Pow', PPC: 'Ppc',
    PPR: 'Ppr', PPT: 'Ppt', PQI: 'Pqi', PRC: 'Prc',
    PRI: 'Pri', PRM: 'Prm', PRO: 'Pro', PRS: 'Prs',
    PRT: 'Prt', PRX: 'Prx', PSC: 'Psc', PSD: 'Psd',
    PSE: 'Pse', PSI: 'Psi', PSL: 'Psl', PSN: 'Psn',
    PST: 'Pst', PTC: 'Ptc', PTI: 'Pti', PTL: 'Ptl',
    PTN: 'Ptn', PTS: 'Pts', PVI: 'Pvi', PVN: 'Pvn',
    PWC: 'Pwc', PWD: 'Pwd', PWR: 'Pwr', PWS: 'Pws',
    PXL: 'Pxl', PXN: 'Pxn', QCC: 'Qcc', QCI: 'Qci',
    QDI: 'QDI', QDS: 'Qds', QIC: 'Qic', QMS: 'Qms',
    QSC: 'Qsc', QSI: 'Qsi', QTC: 'Qtc', QUE: 'Quantum',
    QVC: 'Qvc', QVS: 'Qvs', RAD: 'Rad', RAI: 'Rai',
    RAR: 'Rar', RAS: 'Ras', RAT: 'Rat', RCA: 'RCA',
    RCC: 'Rcc', RCE: 'Rce', RCI: 'Rci', RCL: 'Rcl',
    RCS: 'Rcs', RCT: 'Rct', RDI: 'Rdi', REL: 'Rel',
    REM: 'Rem', REN: 'Ren', RES: 'Res', REV: 'Rev',
    REX: 'Rex', RIC: 'Ric', RII: 'Rii', RIS: 'Ris',
    RLC: 'Rlc', RLI: 'Rli', RMC: 'Rmc', RMI: 'Rmi',
    RMS: 'Rms', RNC: 'Rnc', ROB: 'Rob', ROC: 'Roc',
    ROI: 'Roi', ROL: 'Rol', ROM: 'Rom', ROS: 'Ros',
    ROT: 'Rot', ROX: 'Rox', RPC: 'Rpc', RPI: 'Rpi',
    RPT: 'Rpt', RSC: 'Rsc', RSI: 'Rsi', RSN: 'Rsn',
    RST: 'Rst', RTC: 'Rtc', RTI: 'Rti', RTL: 'Rtl',
    RTN: 'Rtn', RTS: 'Rts', RUN: 'Run', RVC: 'Rvc',
    RVI: 'Rvi', RVS: 'Rvs', SAC: 'Sac', SAI: 'Sai',
    SAM: 'Samsung Electric', SAN: 'San', SAP: 'Sap',
    SAR: 'Sar', SAS: 'Sas', SAT: 'Sat', SBN: 'Sbn',
    SCE: 'Sce', SCI: 'Sci', SCL: 'Scl', SCM: 'Scm',
    SCN: 'Scn', SCO: 'Sco', SCP: 'Scp', SCR: 'Scr',
    SCS: 'Scs', SCT: 'Sct', SCX: 'Scx', SDI: 'Sdi',
    SDL: 'Sdl', SDM: 'Sdm', SDS: 'Sds', SDT: 'Sdt',
    SEA: 'Sea', SEC: 'SEC', SEE: 'See', SEI: 'Sei',
    SEL: 'Sel', SEM: 'Sem', SEN: 'Sen', SEO: 'Seo',
    SEP: 'Sep', SER: 'Ser', SES: 'Ses', SET: 'Set',
    SEV: 'Sev', SFS: 'Sfs', SGA: 'Sga', SGC: 'Sgc',
    SGT: 'Sgt', SHA: 'Sha', SHC: 'Shc', SHE: 'She',
    SHI: 'Shi', SHM: 'Shm', SHP: 'Sharp', SHS: 'Shs',
    SHT: 'Sht', SIB: 'Sib', SIC: 'Sic', SID: 'Sid',
    SIE: 'Siemens', SII: 'Sii', SIL: 'Silicon Image',
    SIM: 'Sim', SIN: 'Sin', SIS: 'SiS', SIT: 'Sit',
    SKD: 'Skd', SKI: 'Ski', SKY: 'Sky', SLC: 'Slc',
    SLI: 'Sli', SLS: 'Sls', SMC: 'Smc', SMI: 'Smi',
    SMS: 'Sms', SNI: 'Sni', SNK: 'Snk', SNN: 'Snn',
    SNP: 'Snp', SNR: 'Snr', SNS: 'Sns', SNT: 'Snt',
    SNX: 'Snx', SOC: 'Soc', SOI: 'Soi', SOL: 'Sol',
    SON: 'Sony', SOS: 'Sos', SOT: 'Sot', SPC: 'Spc',
    SPE: 'Spe', SPL: 'Spl', SPM: 'Spm', SPN: 'Spn',
    SPS: 'Sps', SPT: 'Spt', SPX: 'Spx', SRC: 'Src',
    SRE: 'Sre', SRI: 'Sri', SRL: 'Srl', SRN: 'Srn',
    SRS: 'Srs', SRT: 'Srt', SSC: 'Ssc', SSD: 'Ssd',
    SSE: 'Sse', SSI: 'Ssi', SSL: 'Ssl', SSM: 'Ssm',
    SSN: 'Ssn', SSR: 'Ssr', SSS: 'Sss', SST: 'Sst',
    STB: 'STB Systems', STC: 'Stc', STD: 'Std',
    STE: 'Ste', STF: 'Stf', STI: 'Sti', STL: 'Stl',
    STM: 'STM', STN: 'Stn', STP: 'Stp', STR: 'Str',
    STS: 'Sts', STT: 'Stt', STU: 'Stu', STV: 'Stv',
    STW: 'Stw', STX: 'Stx', SUI: 'Sui', SUM: 'Sum',
    SUN: 'Sun', SUP: 'Sup', SUR: 'Sur', SVC: 'Svc',
    SVD: 'Svd', SVI: 'Svi', SVL: 'Svl', SVN: 'Svn',
    SVS: 'Svs', SVT: 'Svt', SWI: 'Swi', SWN: 'Swn',
    SWT: 'Swt', SXC: 'Sxc', SXI: 'Sxi', SYC: 'Syc',
    SYN: 'Syn', SYS: 'Sys', TAB: 'Tab', TAC: 'Tac',
    TAI: 'Tai', TAM: 'Tam', TAN: 'Tan', TAT: 'Tat',
    TAV: 'Tav', TAX: 'Tax', TBC: 'Tbc', TCC: 'Tcc',
    TCI: 'Tci', TCL: 'Tcl', TCM: 'Tcm', TCO: 'Tco',
    TCS: 'Tcs', TCT: 'Tct', TDC: 'Tdc', TDI: 'Tdi',
    TDL: 'Tdl', TDS: 'Tds', TDT: 'Tdt', TEA: 'Tea',
    TEC: 'Tec', TECMAR: 'Tecmar', TEK: 'Tektronix',
    TEL: 'Tel', TEM: 'Tem', TEN: 'Ten', TER: 'Ter',
    TES: 'Tes', TET: 'Tet', TEX: 'Tex', TGI: 'Tgi',
    TGS: 'Tgs', THA: 'Tha', THC: 'Thc', THD: 'Thomson',
    THI: 'Thi', THL: 'Thl', THM: 'Thm', THN: 'Thn',
    THO: 'Tho', THP: 'Thp', THR: 'Thr', THS: 'Ths',
    THT: 'Tht', THU: 'Thu', TIA: 'Tia', TIC: 'Tic',
    TIE: 'Tie', TIG: 'Tig', TII: 'Tii', TIL: 'Til',
    TIM: 'Tim', TIN: 'Tin', TIO: 'Tio', TIP: 'Tip',
    TIS: 'Tis', TIT: 'Tit', TIV: 'Tiv', TIX: 'Tix',
    TLC: 'Tlc', TLI: 'Tli', TLM: 'Tlm', TLS: 'Tls',
    TLT: 'Tlt', TLV: 'Tlv', TMC: 'Tmc', TMI: 'Tmi',
    TMM: 'Tmm', TMS: 'Tms', TMT: 'Tmt', TMX: 'Tmx',
    TNC: 'Tnc', TND: 'Tnd', TNI: 'Tni', TNL: 'Tnl',
    TNS: 'Tns', TNT: 'Tnt', TNX: 'Tnx', TOS: 'Toshiba',
    TPC: 'Tpc', TPI: 'Tpi', TPL: 'Tpl', TPM: 'Tpm',
    TPS: 'Tps', TPT: 'Tpt', TPV: 'TPV Technology',
    TRC: 'Trc', TRI: 'Tri', TRL: 'Trl', TRM: 'Trm',
    TRN: 'Trn', TRS: 'Trs', TRT: 'Trt', TRX: 'Trx',
    TSC: 'Tsc', TSD: 'Tsd', TSI: 'Tsi', TSL: 'Tsl',
    TSM: 'Tsm', TSN: 'Tsn', TSP: 'Tsp', TSS: 'Tss',
    TST: 'Tst', TTC: 'Ttc', TTI: 'Tti', TTL: 'Ttl',
    TTM: 'Ttm', TTN: 'Ttn', TTS: 'Tts', TTX: 'Ttx',
    TUL: 'Tul', TUT: 'Tut', TVI: 'Tvi', TVM: 'Tvm',
    TVN: 'Tvn', TVS: 'TVS Electronics', TWC: 'Twc',
    TWI: 'Twi', TWN: 'Twn', TXI: 'Txi', TXN: 'Txn',
    TYA: 'Tya', UAC: 'Uac', UCC: 'Ucc', UCI: 'Uci',
    UEC: 'Uec', UIC: 'Uic', ULT: 'Ult', UMC: 'Umc',
    UNI: 'Uni', UNM: 'Unm', UNT: 'Unt', UNY: 'Uny',
    UPP: 'Upp', USI: 'Usi', USR: 'US Robotics',
    UTS: 'Uts', VAD: 'Vad', VAI: 'Vai', VAL: 'Val',
    VAN: 'Van', VAR: 'Var', VAS: 'Vas', VCI: 'Vci',
    VCS: 'Vcs', VDC: 'Vdc', VDO: 'Vdo', VDS: 'Vds',
    VEC: 'Vec', VEI: 'Vei', VEN: 'Ven', VER: 'Ver',
    VES: 'Ves', VIA: 'VIA Technologies', VIC: 'Vic',
    VID: 'Vid', VIE: 'Vie', VIL: 'Vil', VIN: 'Vin',
    VIO: 'Vio', VIR: 'Vir', VIS: 'Vis', VIT: 'Vit',
    VIV: 'Viv', VIX: 'Vix', VLI: 'Vli', VLM: 'Vlm',
    VMI: 'Vmi', VMS: 'Vms', VNC: 'Vnc', VNT: 'Vnt',
    VOB: 'Vobis', VOG: 'Vog', VOL: 'Vol', VOR: 'Vor',
    VOX: 'Vox', VPC: 'Vpc', VPI: 'Vpi', VRC: 'Vrc',
    VRI: 'Vri', VRS: 'Vrs', VSC: 'Vsc', VSI: 'Vsi',
    VSL: 'Vsl', VSN: 'Vsn', VSR: 'Vsr', VST: 'Vst',
    VTC: 'Vtc', VTI: 'Vti', VTL: 'Vtl', VTK: 'Vtk',
    VTR: 'Vtr', VTS: 'Vts', VTV: 'Vtv', VUE: 'Vue',
    VUT: 'Vut', VVI: 'Vvi', VVT: 'Vvt', VXL: 'Vxl',
    WAC: 'Wac', WAL: 'Wal', WAN: 'Wan', WAS: 'Was',
    WAV: 'Wav', WBC: 'Wbc', WBS: 'Wbs', WCI: 'Wci',
    WCS: 'Wcs', WDC: 'Western Digital', WDE: 'Wde',
    WEL: 'Wel', WES: 'Wes', WFC: 'Wfc', WHT: 'Wht',
    WIN: 'Win', WIP: 'Wip', WIS: 'Wis', WIT: 'Wit',
    WLD: 'Wld', WMS: 'Wms', WNC: 'Wnc', WNI: 'Wni',
    WPI: 'Wpi', WSC: 'Wsc', WSI: 'Wsi', WTC: 'Wtc',
    WTI: 'Wti', WTL: 'Wtl', WTS: 'Wts', WVN: 'Wvn',
    WYS: 'Wys', XAC: 'Xac', XAN: 'Xan', XAV: 'Xav',
    XCO: 'Xco', XEN: 'Xen', XER: 'Xerox', XIO: 'Xio',
    XIR: 'Xir', XIT: 'Xit', XLC: 'Xlc', XMI: 'Xmi',
    XNI: 'Xni', XPC: 'Xpc', XPI: 'Xpi', XRO: 'Xro',
    XSC: 'Xsc', XSI: 'Xsi', XST: 'Xst', XTC: 'Xtc',
    XTI: 'Xti', XTR: 'Xtr', XVE: 'Xve', XYL: 'Xyl',
    YAK: 'Yak', YAM: 'Yamaha', YAS: 'Yas', YCC: 'Ycc',
    YDS: 'Yds', YED: 'Yed', YEL: 'Yel', YES: 'Yes',
    YKC: 'Ykc', YMH: 'Ymh', YOW: 'Yow', YTC: 'Ytc',
    YUC: 'Yuc', YUP: 'Yup', ZAN: 'Zan', ZAX: 'Zax',
    ZCM: 'Zcm', ZDS: 'Zds', ZEN: 'Zen', ZGT: 'Zgt',
    ZIC: 'Zic', ZMC: 'Zmc', ZMT: 'Zmt', ZNI: 'Zni',
    ZOT: 'Zot', ZSE: 'Zse', ZTC: 'Ztc', ZTI: 'Zti',
    ZWE: 'Zwe', ZYT: 'Zyt'
  };

  /* ------------------------------------------------- Established timings */
  /* [byte offset from 0x23, bit, label, width, height, refresh, interlaced] */
  var ESTABLISHED = [
    [0, 7, '720×400@70', 720, 400, 70, false, 28320, 900, 449],
    [0, 6, '720×400@88', 720, 400, 88, false, 35500, 900, 449],
    [0, 5, '640×480@60', 640, 480, 60, false, 25175, 800, 525],
    [0, 4, '640×480@67', 640, 480, 67, false, 30240, 864, 525],
    [0, 3, '640×480@72', 640, 480, 72, false, 31500, 832, 520],
    [0, 2, '640×480@75', 640, 480, 75, false, 31500, 840, 500],
    [0, 1, '800×600@56', 800, 600, 56, false, 36000, 1024, 625],
    [0, 0, '800×600@60', 800, 600, 60, false, 40000, 1056, 628],
    [1, 7, '800×600@72', 800, 600, 72, false, 50000, 1040, 666],
    [1, 6, '800×600@75', 800, 600, 75, false, 49500, 1056, 625],
    [1, 5, '832×624@75', 832, 624, 75, false, 57284, 1152, 667],
    [1, 4, '1024×768@87i', 1024, 768, 87, true, 44900, 1264, 817],
    [1, 3, '1024×768@60', 1024, 768, 60, false, 65000, 1344, 806],
    [1, 2, '1024×768@70', 1024, 768, 70, false, 75000, 1328, 806],
    [1, 1, '1024×768@75', 1024, 768, 75, false, 78750, 1312, 800],
    [1, 0, '1280×1024@75', 1280, 1024, 75, false, 135000, 1688, 1066],
    [2, 7, '1152×870@75', 1152, 870, 75, false, 108000, 1472, 976]
  ];

  /* -------------------------------------------------- Standard aspect map */
  var ASPECTS = [
    { code: 0, label: '16:10', ratio: 16 / 10 },
    { code: 1, label: '4:3', ratio: 4 / 3 },
    { code: 2, label: '5:4', ratio: 5 / 4 },
    { code: 3, label: '16:9', ratio: 16 / 9 }
  ];

  /* -------------------------------------------------------- CEA-861 tables */
  /* CTA-861 Video Identification Codes.  VIC 0 is "no video", VIC 1..64 and
     93..107 are fully defined; 65..92 are parameterised entries that a source
     device may define itself, so they are marked reserved rather than wrong. */
  var CEA_VIDEO_CODES = [
    null,                                                                     /* 0   */
    { w: 640, h: 480, r: 59.94 },                                             /* 1   */
    { w: 720, h: 480, r: 59.94, ar: '4:3' },                                  /* 2   */
    { w: 720, h: 480, r: 59.94, ar: '16:9' },                                 /* 3   */
    { w: 1280, h: 720, r: 59.94 },                                            /* 4   */
    { w: 1920, h: 1080, r: 59.94, i: true },                                  /* 5   */
    { w: 1440, h: 480, r: 59.94, i: true, ar: '4:3', dots: 720 },             /* 6   */
    { w: 1440, h: 480, r: 59.94, i: true, ar: '16:9', dots: 720 },            /* 7   */
    { w: 1440, h: 240, r: 59.94, ar: '4:3', dots: 720 },                      /* 8   */
    { w: 1440, h: 240, r: 59.94, ar: '16:9', dots: 720 },                     /* 9   */
    { w: 2880, h: 480, r: 59.94, i: true, dots: 720 },                        /* 10  */
    { w: 2880, h: 480, r: 59.94, i: true, dots: 720 },                        /* 11  */
    { w: 2880, h: 240, r: 59.94, dots: 720 },                                 /* 12  */
    { w: 2880, h: 240, r: 59.94, dots: 720 },                                 /* 13  */
    { w: 1440, h: 480, r: 59.94, ar: '4:3', dots: 720 },                      /* 14  */
    { w: 1440, h: 480, r: 59.94, ar: '16:9', dots: 720 },                     /* 15  */
    { w: 1920, h: 1080, r: 59.94 },                                           /* 16  */
    { w: 720, h: 576, r: 50, ar: '4:3' },                                     /* 17  */
    { w: 720, h: 576, r: 50, ar: '16:9' },                                    /* 18  */
    { w: 1280, h: 720, r: 50 },                                               /* 19  */
    { w: 1920, h: 1080, r: 50, i: true },                                     /* 20  */
    { w: 1440, h: 576, r: 50, i: true, ar: '4:3', dots: 720 },                /* 21  */
    { w: 1440, h: 576, r: 50, i: true, ar: '16:9', dots: 720 },               /* 22  */
    { w: 1440, h: 288, r: 50, ar: '4:3', dots: 720 },                         /* 23  */
    { w: 1440, h: 288, r: 50, ar: '16:9', dots: 720 },                        /* 24  */
    { w: 2880, h: 576, r: 50, i: true, dots: 720 },                           /* 25  */
    { w: 2880, h: 576, r: 50, i: true, dots: 720 },                           /* 26  */
    { w: 2880, h: 288, r: 50, dots: 720 },                                    /* 27  */
    { w: 2880, h: 288, r: 50, dots: 720 },                                    /* 28  */
    { w: 1440, h: 576, r: 50, ar: '4:3', dots: 720 },                         /* 29  */
    { w: 1440, h: 576, r: 50, ar: '16:9', dots: 720 },                        /* 30  */
    { w: 1920, h: 1080, r: 50 },                                              /* 31  */
    { w: 1920, h: 1080, r: 23.98 },                                           /* 32  */
    { w: 1920, h: 1080, r: 25 },                                              /* 33  */
    { w: 1920, h: 1080, r: 29.97 },                                           /* 34  */
    { w: 2880, h: 480, r: 59.94, ar: '4:3', dots: 720 },                      /* 35  */
    { w: 2880, h: 480, r: 59.94, ar: '16:9', dots: 720 },                     /* 36  */
    { w: 2880, h: 576, r: 50, ar: '4:3', dots: 720 },                         /* 37  */
    { w: 2880, h: 576, r: 50, ar: '16:9', dots: 720 },                        /* 38  */
    { w: 1920, h: 1080, r: 50, i: true },                                     /* 39  */
    { w: 1920, h: 1080, r: 100, i: true },                                    /* 40  */
    { w: 1280, h: 720, r: 100 },                                              /* 41  */
    { w: 720, h: 576, r: 100, ar: '4:3' },                                    /* 42  */
    { w: 720, h: 576, r: 100, ar: '16:9' },                                   /* 43  */
    { w: 1440, h: 576, r: 100, i: true, ar: '4:3', dots: 720 },               /* 44  */
    { w: 1440, h: 576, r: 100, i: true, ar: '16:9', dots: 720 },              /* 45  */
    { w: 1920, h: 1080, r: 119.88, i: true },                                 /* 46  */
    { w: 1280, h: 720, r: 119.88 },                                           /* 47  */
    { w: 720, h: 480, r: 119.88, ar: '4:3' },                                 /* 48  */
    { w: 720, h: 480, r: 119.88, ar: '16:9' },                                /* 49  */
    { w: 1440, h: 480, r: 119.88, i: true, ar: '4:3', dots: 720 },            /* 50  */
    { w: 1440, h: 480, r: 119.88, i: true, ar: '16:9', dots: 720 },           /* 51  */
    { w: 720, h: 576, r: 200, ar: '4:3' },                                    /* 52  */
    { w: 720, h: 576, r: 200, ar: '16:9' },                                   /* 53  */
    { w: 1440, h: 576, r: 200, i: true, ar: '4:3', dots: 720 },               /* 54  */
    { w: 1440, h: 576, r: 200, i: true, ar: '16:9', dots: 720 },              /* 55  */
    { w: 720, h: 480, r: 239.76, ar: '4:3' },                                 /* 56  */
    { w: 720, h: 480, r: 239.76, ar: '16:9' },                                /* 57  */
    { w: 1440, h: 480, r: 239.76, i: true, ar: '4:3', dots: 720 },            /* 58  */
    { w: 1440, h: 480, r: 239.76, i: true, ar: '16:9', dots: 720 },           /* 59  */
    { w: 1280, h: 720, r: 23.98 },                                            /* 60  */
    { w: 1280, h: 720, r: 25 },                                               /* 61  */
    { w: 1280, h: 720, r: 29.97 },                                            /* 62  */
    { w: 1920, h: 1080, r: 119.88 },                                          /* 63  */
    { w: 1920, h: 1080, r: 100 },                                             /* 64  */
    /* 65..92 — parameterised / source-defined entries, not in the base table */
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { reserved: true }, { reserved: true }, { reserved: true }, { reserved: true },
    { w: 3840, h: 2160, r: 23.98 },                                           /* 93  */
    { w: 3840, h: 2160, r: 25 },                                              /* 94  */
    { w: 3840, h: 2160, r: 29.97 },                                           /* 95  */
    { w: 3840, h: 2160, r: 50 },                                              /* 96  */
    { w: 3840, h: 2160, r: 59.94 },                                           /* 97  */
    { w: 4096, h: 2160, r: 23.98 },                                           /* 98  */
    { w: 4096, h: 2160, r: 25 },                                              /* 99  */
    { w: 4096, h: 2160, r: 29.97 },                                           /* 100 */
    { w: 4096, h: 2160, r: 50 },                                              /* 101 */
    { w: 4096, h: 2160, r: 59.94 },                                           /* 102 */
    { w: 3840, h: 2160, r: 119.88 },                                          /* 103 */
    { w: 3840, h: 2160, r: 100 },                                             /* 104 */
    { w: 3840, h: 2160, r: 50, ycc420: true },                                /* 105 */
    { w: 3840, h: 2160, r: 59.94, ycc420: true },                             /* 106 */
    { w: 3840, h: 2160, r: 119.88, ycc420: true }                             /* 107 */
  ];

  var CEA_MAX_VIC = 107;

  function ceaVideoLabel(code) {
    var info = CEA_VIDEO_CODES[code];
    if (!info) return 'VIC ' + code + ' (undefined)';
    if (info.reserved) return 'VIC ' + code + ' (parameterised)';
    var label = info.w + '×' + info.h + (info.i ? 'i' : 'p') + '@' + info.r;
    if (info.dots && info.dots !== info.w) label += ' (' + info.w + ' dots, ' + info.dots + ' visible)';
    if (info.ar) label += ' ' + info.ar;
    if (info.ycc420) label += ' YCbCr 4:2:0';
    return label;
  }

  var CEA_AUDIO_FORMATS = [
    null, 'LPCM', 'AC-3', 'MPEG-1 (Layers 1 & 2)', 'MP3', 'MPEG2 (multichannel)',
    'AAC LC', 'DTS', 'ATRAC', 'One Bit Audio', 'Enhanced AC-3', 'DTS-HD',
    'MAT (MLP)', 'DST', 'WMA Pro'
  ];

  var SPEAKER_ALLOCATION = [
    [0, 'FL/FR (Front Left / Right)'],
    [1, 'LFE (Low Frequency Effects)'],
    [2, 'FC (Front Center)'],
    [3, 'BL/BR (Back Left / Right)'],
    [4, 'BC (Back Center)'],
    [5, 'FLC/FRC (Front Left / Right of Center)'],
    [6, 'RLC/RRC (Rear Left / Right of Center)'],
    [7, 'FLW/FRW (Front Left / Right Wide)'],
    [8, 'FLH/FRH (Front Left / Right High)'],
    [9, 'TC (Top Center)'],
    [10, 'FCH (Front Center High)']
  ];

  var COLOR_ENCODING = [
    'RGB 4:4:4', 'RGB 4:4:4 + YCrCb 4:4:4',
    'RGB 4:4:4 + YCrCb 4:2:2', 'RGB 4:4:4 + YCrCb 4:4:4 + 4:2:2'
  ];
  var DIGITAL_INTERFACE = ['Undefined', 'DVI', 'HDMI-a', 'HDMI-b', 'MDDI', 'DisplayPort'];
  var BIT_DEPTH = ['Undefined', '6 bits per primary color', '8 bits per primary color',
    '10 bits per primary color', '12 bits per primary color',
    '14 bits per primary color', '16 bits per primary color'];
  var VIDEO_LEVEL = ['0.700 / 0.300 / 1.000 V p-p', '0.714 / 0.286 / 1.000 V p-p',
    '1.000 / 0.400 / 1.400 V p-p', '0.700 / 0.000 / 0.700 V p-p'];

  var DESCRIPTOR_TAGS = {
    0xFF: { name: 'Monitor Serial Number', kind: 'text' },
    0xFE: { name: 'Unspecified Text', kind: 'text' },
    0xFC: { name: 'Monitor Name', kind: 'text' },
    0xFD: { name: 'Display Range Limits', kind: 'range' },
    0xFB: { name: 'Additional White Point', kind: 'whitepoint' },
    0xFA: { name: 'Additional Standard Timings', kind: 'std' },
    0xF9: { name: 'Color Management Data', kind: 'cms' },
    0xF8: { name: 'CVT 3 Byte Timing Codes', kind: 'cvt' },
    0xF7: { name: 'Established Timings III', kind: 'est3' },
    0x10: { name: 'Dummy Descriptor', kind: 'dummy' }
  };

  var EXT_TAGS = {
    0x00: 'Timing Extension (deprecated)',
    0x02: 'CEA-861 Extension',
    0x10: 'Video Timing Block Extension (VTB-EXT)',
    0x20: 'EDID 2.0 Extension',
    0x40: 'Display Information Extension (DI-EXT)',
    0x50: 'Localized String Extension (LS-EXT)',
    0x60: 'Microdisplay Interface Extension (MI-EXT)',
    0x70: 'DisplayID Extension',
    0xA7: 'Display Transfer Characteristics (DTCDB)',
    0xAF: 'Block Map Extension',
    0xBF: 'Display Device Data Block (DDDB)',
    0xF0: 'Block Map (legacy)',
    0xFF: 'Manufacturer-defined Extension',
    0x0A: 'DVI Feature Data Block (DFP 1.x)'
  };

  /* -------------------------------------------------------------- helpers */
  function toBytes(input) {
    if (input == null) return null;
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (Array.isArray(input)) {
      if (!input.length || !input.every(function (b) { return Number.isInteger(b) && b >= 0 && b <= 255; })) return null;
      return new Uint8Array(input);
    }
    if (typeof input === 'string') {
      var s = input.replace(/0x/gi, '').replace(/[\s,;:\-]/g, '').replace(/\|/g, '');
      if (!s || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return null;
      var out = new Uint8Array(s.length / 2);
      for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
      return out;
    }
    return null;
  }

  function bytesToHex(bytes, upper) {
    var parts = [];
    for (var i = 0; i < bytes.length; i++) {
      parts.push((bytes[i] < 16 ? '0' : '') + bytes[i].toString(16));
    }
    var s = parts.join(' ');
    return upper === false ? s : s.toUpperCase();
  }

  function bytesToHexCompact(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s.toUpperCase();
  }

  function hexToPadded(n, width) {
    if (n == null || typeof n !== 'number' || !isFinite(n)) return '--';
    var neg = n < 0;
    var s = Math.abs(n).toString(16).toUpperCase();
    while (s.length < width) s = '0' + s;
    return (neg ? '-' : '') + s;
  }

  function checksum(bytes, offset, length) {
    var sum = 0;
    for (var i = 0; i < length; i++) sum = (sum + bytes[offset + i]) & 0xFF;
    return (256 - (sum % 256)) % 256;
  }

  function makeChecksum(bytes, offset) {
    var copy = new Uint8Array(bytes);
    copy[offset + BLOCK_SIZE - 1] = 0;
    var sum = 0;
    for (var i = 0; i < BLOCK_SIZE; i++) sum = (sum + copy[offset + i]) & 0xFF;
    return (256 - (sum % 256)) % 256;
  }

  function isHeaderOk(bytes, offset) {
    if (bytes.length < offset + 8) return false;
    for (var i = 0; i < 8; i++) if (bytes[offset + i] !== HEADER[i]) return false;
    return true;
  }

  function manufacturerFromBytes(b0, b1) {
    var v = ((b0 << 8) | b1) & 0x7FFF;
    var chars = [
      String.fromCharCode(((v >> 10) & 0x1F) + 64),
      String.fromCharCode(((v >> 5) & 0x1F) + 64),
      String.fromCharCode((v & 0x1F) + 64)
    ];
    var code = chars.join('');
    return { code: code, value: v, vendor: EISA[code] || null, valid: /^[A-Z]{3}$/.test(code) };
  }

  function manufacturerToBytes(code) {
    var c = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
    while (c.length < 3) c += 'A';
    c = c.substring(0, 3);
    var v = ((c.charCodeAt(0) - 64) << 10) | ((c.charCodeAt(1) - 64) << 5) | (c.charCodeAt(2) - 64);
    return [(v >> 8) & 0xFF, v & 0xFF];
  }

  /* 10-bit chromaticity value -> CIE x/y */
  function chromaToXy(b0, b1, b2, b3) {
    var x = ((b0 << 2) | ((b2 >> 6) & 3)) & 0x3FF;
    var y = ((b1 << 2) | ((b2 >> 4) & 3)) & 0x3FF;
    void b3;
    return { x: x / 1024, y: y / 1024, raw: { x: x, y: y } };
  }

  function xyToChroma(v) {
    var n = Math.max(0, Math.min(1023, Math.round(v * 1024)));
    return n;
  }

  function tempKFromXy(x, y) {
    /* McCamy's approximation for correlated colour temperature */
    if (!(x > 0 && y > 0)) return null;
    var n = (x - 0.3320) / (0.1858 - y);
    var cct = 449 * n * n * n + 3525 * n * n + 6823.3 * n + 5520.33;
    if (!isFinite(cct) || cct < 1000 || cct > 40000) return null;
    return Math.round(cct);
  }

  function sRGBChromaticity() {
    return {
      red: { x: Math.round(0.640 * 1024) / 1024, y: Math.round(0.330 * 1024) / 1024 },
      green: { x: Math.round(0.300 * 1024) / 1024, y: Math.round(0.600 * 1024) / 1024 },
      blue: { x: Math.round(0.150 * 1024) / 1024, y: Math.round(0.060 * 1024) / 1024 },
      white: { x: Math.round(0.3127 * 1024) / 1024, y: Math.round(0.3290 * 1024) / 1024 }
    };
  }

  /* EDID text descriptors: 13 bytes, terminated by 0x0A (or 0x00 in the wild)
     and padded with 0x20.  The terminator itself is not part of the text and
     the padding is reported separately so callers can verify the convention. */
  function parseEdidString(bytes, offset, length) {
    var max = offset + length;
    var end = offset;
    while (end < max && bytes[end] !== 0x0A && bytes[end] !== 0x00) end++;
    var s = '';
    for (var i = offset; i < end; i++) s += String.fromCharCode(bytes[i]);
    var terminated = end < max;
    var trailing = [];
    for (var j = terminated ? end + 1 : end; j < max; j++) trailing.push(bytes[j]);
    return {
      text: s.replace(/ +$/, ''),
      rawEnd: end,
      rawLength: end - offset,
      terminated: terminated,
      terminator: terminated ? bytes[end] : null,
      trailing: trailing
    };
  }

  function formatClock(kHz) {
    if (kHz == null) return '-';
    if (kHz >= 1000) return (kHz / 1000).toFixed(3) + ' MHz';
    return kHz + ' kHz';
  }

  function diagonalInches(wCm, hCm) {
    if (!wCm || !hCm) return null;
    var diagCm = Math.sqrt(wCm * wCm + hCm * hCm);
    return diagCm / 2.54;
  }

  /* Established-timing labels are written many ways in the wild
     ("640x480@60", "640×480 @ 60 Hz", "1024x768@87i").  Compare them by
     stripping every non-alphanumeric character so a model may use plain
     ASCII and still match the canonical table. */
  function establishedKey(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\u00d7\u2715\u2716\u00a0]/g, 'x')   /* × and friends -> x */
      .replace(/[^a-z0-9]/g, '');
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  function aspectRatioLabel(w, h) {
    if (!w || !h) return '-';
    var g = gcd(w, h);
    var a = w / g, b = h / g;
    if (a <= 64 && b <= 64) return a + ':' + b;
    return (w / h).toFixed(3) + ':1';
  }

  global.EDIDCore = {
    HEADER: HEADER,
    BLOCK_SIZE: BLOCK_SIZE,
    MAX_BLOCKS: MAX_BLOCKS,
    EISA: EISA,
    ESTABLISHED: ESTABLISHED,
    ASPECTS: ASPECTS,
    CEA_VIDEO_CODES: CEA_VIDEO_CODES,
    CEA_MAX_VIC: CEA_MAX_VIC,
    ceaVideoLabel: ceaVideoLabel,
    CEA_AUDIO_FORMATS: CEA_AUDIO_FORMATS,
    SPEAKER_ALLOCATION: SPEAKER_ALLOCATION,
    COLOR_ENCODING: COLOR_ENCODING,
    DIGITAL_INTERFACE: DIGITAL_INTERFACE,
    BIT_DEPTH: BIT_DEPTH,
    VIDEO_LEVEL: VIDEO_LEVEL,
    DESCRIPTOR_TAGS: DESCRIPTOR_TAGS,
    EXT_TAGS: EXT_TAGS,
    toBytes: toBytes,
    bytesToHex: bytesToHex,
    bytesToHexCompact: bytesToHexCompact,
    hex: hexToPadded,
    checksum: checksum,
    makeChecksum: makeChecksum,
    isHeaderOk: isHeaderOk,
    manufacturerFromBytes: manufacturerFromBytes,
    manufacturerToBytes: manufacturerToBytes,
    chromaToXy: chromaToXy,
    xyToChroma: xyToChroma,
    tempKFromXy: tempKFromXy,
    sRGBChromaticity: sRGBChromaticity,
    establishedKey: establishedKey,
    parseEdidString: parseEdidString,
    formatClock: formatClock,
    diagonalInches: diagonalInches,
    aspectRatioLabel: aspectRatioLabel
  };
})(typeof window !== 'undefined' ? window : this);
