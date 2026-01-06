<template>
  <HighlightedCodePanel type="html" :value="code" />
</template>

<script setup lang="ts">
import HighlightedCodePanel from './helper/HighlightedCodePanel.vue'
import { useInspectorDrawer } from '../../documents/editor/editor.store'
import { computed, ref, watch } from 'vue';
import { renderToStaticMarkup } from '../../lib/email-builder';
/* import { renderToStaticMarkup } from '@flyhub/email-builder' */
import { createProcessedDocument, processDocumentVariables } from '../../utils/documentProcessor';
import { interpolateVariables } from '../../utils/variableInterpolator';

const inspectorDrawer = useInspectorDrawer()

const code = ref<string>('')

const processedDocument = computed(() => {  
  return createProcessedDocument(
    inspectorDrawer.document,
    inspectorDrawer.globalVariables
  )  
});  

const htmlImported = `
<meta charset="utf-8" style=" box-sizing: border-box;">
<meta name="viewport" content="width=device-width,initial-scale=1" style=" box-sizing: border-box;">
<meta name="x-apple-disable-message-reformatting" style=" box-sizing: border-box;">
<title style=" box-sizing: border-box;"></title>
<div role="article" aria-roledescription="email" lang="en" id="i8hog" style=" box-sizing: border-box; text-size-adjust: 100%; background-color: rgb(255, 255, 255);">
  <table role="presentation" id="ip8ez" style=" box-sizing: border-box; width: 100%; border: none; border-spacing: 0px;">
    <tbody id="iulxm" style=" box-sizing: border-box;">
      <tr id="iowpu" style=" box-sizing: border-box;">
        <td align="center" id="ibbpk" style=" box-sizing: border-box; padding: 0px;">
          <!--[if mso]>
            <table role="presentation" align="center" style="width:600px;">
                <tr>
                    <td>
                        <![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" id="i746a" style=" box-sizing: border-box; background-color: rgb(0, 48, 164); width: 100%; max-width: 600px; border: none; border-spacing: 0px; text-align: left; font-family: Arial, sans-serif; font-size: 16px; color: rgb(0, 0, 0);">
            <tbody style=" box-sizing: border-box;">
              <tr id="ih0gc" style=" box-sizing: border-box;">
                <td id="iyjx5" style=" box-sizing: border-box; padding: 20px; text-align: center;">
                  <a href="https://www.celcomlatam.com/" id="ijmkj" style=" box-sizing: border-box; text-decoration: none;">
                    <img src="https://services.celcom.cl/imagenes/36_1762442267368/mail_celcom_logo.png" width="101" alt="Logo" id="i17v9" style=" box-sizing: border-box; width: 101px; max-width: 100%; height: auto; border: none;">
                  </a>
                </td>
              </tr>
              <tr id="i5pwm" style=" box-sizing: border-box;">
                <td id="i380z" style=" box-sizing: border-box; padding-bottom: 30px; text-align: center;">
                  <table width="80%" align="center" cellpadding="0" cellspacing="0" border="0" id="ilzvi" style=" box-sizing: border-box;">
                    <tbody id="ibdgd" style=" box-sizing: border-box;">
                      <tr id="ifmmz" style=" box-sizing: border-box;">
                        <td id="ipjpf" style=" box-sizing: border-box; max-width: 200px; width: 100%; display: inline-block;">
                          <img src="img_hero_p3.png" width="258" alt="Imagen Principal 3D" id="iy68u" style=" box-sizing: border-box; width: 182px; max-width: 100%; height: 188px; display: block;">
                        </td>
                        <td id="i5fca" style=" box-sizing: border-box; width: 100%; max-width: 250px; display: inline-block;">
                          <p id="i13gk" style=" box-sizing: border-box; font-size: 27px; font-weight: 600; color: rgb(255, 154, 1); text-align: left; font-style: italic; padding: 0px;">¡Te deseamos feliz navidad!</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td style=" box-sizing: border-box;">
                  <table width="100%" align="center" cellpadding="0" cellspacing="0" border="0" id="ivpl4" style=" box-sizing: border-box; background-color: rgb(240, 239, 239);">
                    <tbody style=" box-sizing: border-box;">
                      <tr style=" box-sizing: border-box;">
                        <td id="ig64y" style=" box-sizing: border-box; padding: 35px 0px 0px;">
                          <table width="80%" align="center" cellpadding="0" cellspacing="0" border="0" style=" box-sizing: border-box;">
                            <tbody id="iqg5o" style=" box-sizing: border-box;">
                              <tr id="i224j" style=" box-sizing: border-box;">
                                <td id="i4215" style=" box-sizing: border-box; padding-bottom: 20px;">
                                  <section class="bdg-sect" style=" box-sizing: border-box;">
                                    <p id="i7rbi" style=" box-sizing: border-box; font-size: 16px;">Este año estuvimos detrás de millones de conversaciones: recordatorios de cita, mensajes de cobranza, avisos de entrega, campañas de retail, confirmaciones de clases y más. <br style=" box-sizing: border-box;">
                                      <br style=" box-sizing: border-box;">Cada clic y cada mensaje que enviaste con Celcom significó una persona mejor informada, atendida o acompañada. <br style=" box-sizing: border-box;">
                                    </p>
                                    <p id="iv70f" style=" box-sizing: border-box; color: rgb(255, 154, 1); font-size: 20px; font-weight: bolder; text-align: center; font-style: italic; margin: 0px;">Y eso ha sido todo un regalo para nosotros este 2025.&nbsp; <br style=" box-sizing: border-box;">
                                      <!-- notionvc: a80bb728-a9de-4c55-abba-ac1ab5dbfc73 -->
                                    </p>
                                    <p id="iqssj" style=" box-sizing: border-box; font-size: 16px;">Es por eso que queremos ser nosotros quienes hoy enviáramos el mensaje: te deseamos una Navidad en buena compañía y que vengan muchos proyectos que valga la pena comunicar para hacerlo a tu lado. <br style=" box-sizing: border-box;">
                                      <br style=" box-sizing: border-box;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;¡Felices fiestas! <br style=" box-sizing: border-box;">
                                    </p>
                                  </section>
                                </td>
                              </tr>
                              <tr id="i7jrg" style=" box-sizing: border-box;">
                                <td id="ii6hm" style=" box-sizing: border-box; padding: 0px; min-height: 10px;"></td>
                              </tr>
                              <tr id="ibhuon" style=" box-sizing: border-box;">
                                <td id="idpnn" style=" box-sizing: border-box; text-align: center;"></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="idzph" style=" box-sizing: border-box; padding: 10px 0px; text-align: center;">
                  <a href="https://www.celcomlatam.com/" id="im8kk" style=" box-sizing: border-box; text-decoration: none;">
                    <img src="https://services.celcom.cl/imagenes/36_1762442267368/mail_celcom_logo.png" width="107" alt="Logo" id="i8imr" style=" box-sizing: border-box; width: 107px; max-width: 100%; height: auto; border: none;">
                  </a>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="i7iae" style=" box-sizing: border-box; text-align: center; font-size: 10px; line-height: 1;">
                  <a href="mailto:contacto@celcom.cl" id="ilb5x" style=" box-sizing: border-box; text-decoration: none; color: rgb(255, 255, 255);">contacto@celcom.cl</a>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="ib1e9" style=" box-sizing: border-box; text-align: center; font-size: 10px; color: rgb(255, 255, 255); line-height: 1;">
                  <a href="tel:+56 9 5900 3934" id="ir4pf" style=" box-sizing: border-box; text-decoration: none; color: rgb(255, 255, 255);">+56 9 5900 3934</a> / <a href="tel:+56 2 2712 5911" id="iv7qr" style=" box-sizing: border-box; text-decoration: none; color: rgb(255, 255, 255);">+56 2 2712 5911</a>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="iv5ch" style=" box-sizing: border-box; text-align: center; font-size: 10px; color: rgb(255, 255, 255); line-height: 1;"> General Holley 133, Providencia, Santiago. Santiago de Chile. </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="ix0t2" style=" box-sizing: border-box; text-align: center; padding: 20px 0px;">
                  <a href="https://www.facebook.com/CelcomLatam" id="idypg" style=" box-sizing: border-box; text-decoration: none;">
                    <img src="https://services.celcom.cl/imagenes/36_1762442267368/img_mail_celcom_rrss_fb.png" width="22" alt="Logo" id="ifhpn" style=" box-sizing: border-box; width: 22px; max-width: 100%; height: auto; border: none;">
                  </a>
                  <a href="https://www.linkedin.com/company/celcomlatam/" id="ior1w" style=" box-sizing: border-box; text-decoration: none;">
                    <img src="https://services.celcom.cl/imagenes/36_1762442267368/img_mail_celcom_rrss_in.png" width="22" alt="Logo" id="iwx4a" style=" box-sizing: border-box; width: 22px; max-width: 100%; height: auto; border: none;">
                  </a>
                </td>
              </tr>
              <tr style=" box-sizing: border-box;">
                <td id="i1hws" style=" box-sizing: border-box; text-align: center; font-size: 10px; color: rgb(255, 255, 255); line-height: 1; padding-bottom: 20px;">
                  <a href="http://unsubscribe.celcomlatam.com/" id="i46dg" style=" box-sizing: border-box; color: rgb(255, 255, 255);">Cancelar suscripción</a>
                </td>
              </tr>
            </tbody>
          </table>
            <!--[if mso]>
                    </td>
                </tr>
            </table>
            <![endif]-->
        </td>
      </tr>
    </tbody>
  </table>
</div>`

/* code.value = htmlImported */

/* watch(() => inspectorDrawer.document, async (document) => {
  const html = await renderToStaticMarkup(document, { rootBlockId: 'root' })

  code.value = html
}, { immediate: true }) */
watch(() => [inspectorDrawer.document, inspectorDrawer.globalVariables], async () => {  
  const html = await renderToStaticMarkup(processedDocument.value, { rootBlockId: 'root' })
  code.value = html  
}, { immediate: true, deep: true }) 
</script>

